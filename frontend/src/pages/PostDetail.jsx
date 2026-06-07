import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

export default function PostDetail({ loggedIn }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/posts/${id}`)
      .then(res => res.json())
      .then(data => setPost(data))
      .catch(err => console.error(err));
  }, [id]);

  if (!post) return <div className="loading">로딩 중...</div>;

  const handleDelete = async () => {
    if (!confirm('삭제하시겠습니까?')) return;
    const token = localStorage.getItem('token');
    await fetch(`${API}/api/posts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}` 
      }
    });
    navigate('/');
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/')}>← 목록</button>
        {loggedIn && (
          <div style={{ display: 'flex', gap: '8px' }}> {/* div로 묶어서 오른쪽 정렬 유지 */}
            <button onClick={() => navigate(`/edit/${id}`)}>수정</button>
            <button onClick={handleDelete}>삭제</button>
          </div>
        )}
      </header>
      <main>
        <h1>{post.title}</h1>
        <div className="post-date-info">
          <span className="created-date">
            {post.created_at ? new Date(post.created_at).toLocaleDateString('ko-KR') : ''}
          </span>
          {post.updated_at && (
            <span className="updated-date">
              (수정됨: {new Date(post.updated_at).toLocaleDateString('ko-KR')})
            </span>
          )}
        </div>
        <p>{post.content}</p>
        {post.images?.map((img, i) => (
          <img key={i} src={img.url} alt={img.filename} style={{ maxWidth: '100%' }} />
        ))}
      </main>
    </div>
  );
}