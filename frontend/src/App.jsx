import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import './app.css';
import Login from './pages/Login';
import PostList from './pages/PostList';
import PostWrite from './pages/PostWrite';
import PostDetail from './pages/PostDetail';
import PostEdit from './pages/PostEdit';

const API = import.meta.env.VITE_API_URL;

function App() {
  const { theme, toggleTheme } = useTheme();
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  // 새로고침해도 세션 유지 확인
  useEffect(() => {
    // 로컬 스토리지에서 토큰 꺼내기
    const token = localStorage.getItem('token');
    
    // 토큰이 아예 없다면 서버에 물어볼 필요도 없이 로그인 아웃 상태
    if (!token) {
      setLoggedIn(false);
      setChecking(false);
      return;
    }

    // 헤더에 토큰 실어서 백엔드에 유효한지 검사 요청
    fetch(`${API}/api/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setLoggedIn(data.loggedIn);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // 로그아웃 함수 분리
  const handleLogout = async () => {
    localStorage.removeItem('token');
    setLoggedIn(false);
  };

  if (checking) return <div className="loading">loading</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* 누구나 접근 가능 */}
        <Route
          path="/"
          element={<PostList loggedIn={loggedIn} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme}/>}
        />

        {/* 이미 로그인이면 메인으로 */}
        <Route
          path="/login"
          element={
            loggedIn
              ? <Navigate to="/" />
              : <Login onLogin={() => setLoggedIn(true)} />
          }
        />

        {/* 로그인 필요 */}
        <Route
          path="/write"
          element={
            loggedIn
              ? <PostWrite />
              : <Navigate to="/login" />
          }
        />

        <Route
          path="/post/:id"
          element={<PostDetail loggedIn={loggedIn} />}
        />

        <Route 
          path="/edit/:id"
          element={<PostEdit />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;