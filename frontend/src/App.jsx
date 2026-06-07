import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // 추가
import Login from './pages/Login';
import PostList from './pages/PostList';
import PostWrite from './pages/PostWrite';
import PostDetail from './pages/PostDetail';

const API = import.meta.env.VITE_API_URL;

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  // 새로고침해도 세션 유지 확인
  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setLoggedIn(data.loggedIn);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // 로그아웃 함수 분리
  const handleLogout = async () => {
    await fetch(`${API}/api/logout`, { method: 'POST', credentials: 'include' });
    setLoggedIn(false);
  };

  if (checking) return <div className="loading">loading</div>;

  return (
    <BrowserRouter>
      <Routes>
        // 누구나 접근 가능
        <Route
          path="/"
          element={<PostList loggedIn={loggedIn} onLogout={handleLogout} />}
        />

        // 이미 로그인이면 메인으로
        <Route
          path="/login"
          element={
            loggedIn
              ? <Navigate to="/" />
              : <Login onLogin={() => setLoggedIn(true)} />
          }
        />

        // 로그인 필요
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

      </Routes>
    </BrowserRouter>
  );
}

export default App;