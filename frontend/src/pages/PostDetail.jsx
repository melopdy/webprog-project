import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

export default function PostDetail({ loggedIn }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/posts/${id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setPost(data))
      .catch(err => console.error(err));
  }, [id]);

  if (!post) return <div className="loading">로딩 중...</div>;

  const handleDelete = async () => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`${API}/api/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    navigate('/');
  };

  return (
    <div className="container">
      <header>
        <button onClick={() => navigate('/')}>← 목록</button>
        {loggedIn && <button onClick={handleDelete}>삭제</button>}
      </header>
      <main>
        <h1>{post.title}</h1>
        <span>{post.created_at ? new Date(post.created_at).toLocaleDateString('ko-KR') : ''}</span>
        <p>{post.content}</p>
        {post.images?.map((img, i) => (
          <img key={i} src={img.url} alt={img.filename} style={{ maxWidth: '100%' }} />
        ))}
      </main>
    </div>
  );
}