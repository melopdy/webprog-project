import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

export default function PostWrite() {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [images, setImages]   = useState([]);  // 업로드된 이미지 URL 목록
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 이미지 업로드
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    setLoading(true);

    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${API}/api/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        return await res.json();
      }));

      setImages(prev => [...prev, ...uploaded]);
    } catch (err) {
      alert('이미지 업로드 실패');
    } finally {
      setLoading(false);
    }
  };

  // 게시글 저장
const handleSubmit = async () => {
  if (!title) return alert('제목을 입력해주세요.');
  setLoading(true);

  try {
    const res = await fetch(`${API}/api/posts/with-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, content, imageUrls: images }),
    });
    
    const data = await res.json();
    console.log('응답 상태:', res.status, '데이터:', data);  // ← 추가
    
    if (!res.ok) {
      alert(`오류: ${data.error}`);
      return;
    }
    
    if (!data.id) {
      alert(`id 없음: ${JSON.stringify(data)}`);
      return;
    }
    
    navigate(`/post/${data.id}`);
  } catch (err) {
    alert(`게시글 저장 실패: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="container">
      <header>
        <h1>글쓰기</h1>
        <button onClick={() => navigate('/')}>취소</button>
      </header>
      <main>
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder="내용"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={10}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
        />
        {images.length > 0 && (
          <div>
            {images.map((img, i) => (
              <img key={i} src={img.url} alt={img.filename} width={200} />
            ))}
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? '저장 중...' : '게시글 저장'}
        </button>
      </main>
    </div>
  );
}