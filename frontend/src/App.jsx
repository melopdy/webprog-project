import { useState, useEffect } from 'react';
import Login from './pages/Login';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  // 새로고침해도 세션 유지 확인
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setLoggedIn(data.loggedIn);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) return <div className="loading">로딩 중...</div>;

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="app">
      <h1>관리자 페이지</h1>
      <button onClick={async () => {
        await fetch(`${import.meta.env.VITE_API_URL}/api/logout`, { method: 'POST', credentials: 'include' });
        setLoggedIn(false);
      }}>
        로그아웃
      </button>
    </div>
  );
}

export default App;