import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

export default function PostEdit() {
  const { id } = useParams(); // 💡 URL 파라미터에서 게시글 ID 추출
  const navigate = useNavigate();

  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [images, setImages]   = useState([]);  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true); // 💡 초기 데이터 로딩 상태

  // 화면이 켜질 때 기존 게시글 데이터 불러오기
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`${API}/api/posts/${id}`);
        if (!res.ok) throw new Error('게시글을 불러올 수 없습니다.');
        const data = await res.json();

        setTitle(data.title);
        setContent(data.content);
        if (data.images) setImages(data.images); // 기존 이미지 세팅
      } catch (err) {
        alert(err.message);
        navigate('/'); // 실패 시 메인으로
      } finally {
        setFetching(false);
      }
    };
    fetchPost();
  }, [id, navigate]);

  // 이미지 업로드 (기존과 동일)
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${API}/api/upload`, {
          method: 'POST',
          body: formData,
          headers: { 'Authorization': `Bearer ${token}` },
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

  // 선택한 이미지 지우기 (기존과 동일)
  const handleRemoveImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // 게시글 수정 완료 (POST -> PUT 변경)
  const handleSubmit = async () => {
    if (!title) return alert('제목을 입력해주세요.');
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      // 백엔드의 PUT 라우터로 요청
      const res = await fetch(`${API}/api/posts/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content, imageUrls: images }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(`오류: ${data.error}`);
        return;
      }
      
      // 수정 완료 후 해당 게시글 상세 페이지로 이동
      navigate(`/post/${id}`);
    } catch (err) {
      alert(`게시글 수정 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 데이터를 불러오는 중일 때 보여줄 화면
  if (fetching) return <div className="container">데이터를 불러오는 중...</div>;

  return (
    <div className="container">
      <header>
        <h1>글 수정</h1>
        <button onClick={() => navigate(`/post/${id}`)}>취소</button>
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
          <div className="image-preview-container">
            {images.map((img, i) => (
              <div key={i} className="image-wrapper">
                <img src={img.url} alt={img.filename} width={200} />
                <button 
                  type="button" 
                  className="remove-btn"
                  onClick={() => handleRemoveImage(i)}
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? '저장 중...' : '수정 완료'}
        </button>
      </main>
    </div>
  );
}