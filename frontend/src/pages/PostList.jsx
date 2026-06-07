import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

export default function PostList({ loggedIn, onLogout }) {
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/api/posts`)
      .then(res => res.json())
      .then(data => setPosts(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="container">
      <header>
        <h1>게시판</h1>
        <div>
          {loggedIn ? (
            <>
              <button onClick={() => navigate('/write')}>글쓰기</button>
              <button onClick={onLogout}>로그아웃</button>
            </>
          ) : (
            <button onClick={() => navigate('/login')}>로그인</button>
          )}
        </div>
      </header>
      <main>
        {posts.length === 0
          ? <p>게시글이 없습니다.</p>
          : posts.map(post => (
            <div key={post.id} onClick={() => navigate(`/post/${post.id}`)}>
              <h2>{post.title}</h2>
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
            </div>
          ))
        }
      </main>
    </div>
  );
}