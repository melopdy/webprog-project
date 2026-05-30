require('dotenv').config();
const express       = require('express');
const { Pool }      = require('pg');
const redis         = require('redis');
const session       = require('express-session');
const RedisStore    = require('connect-redis').default;
const cors          = require('cors');
const helmet        = require('helmet');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 미들웨어 ──────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── PostgreSQL 연결 ──────────────────────────────
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

pool.connect()
  .then(client => { console.log('✅ PostgreSQL connected'); client.release(); })
  .catch(err => console.error('❌ PostgreSQL error:', err.message));

// ── Redis 연결 ────────────────────────────────────
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  // REDIS_PASSWORD가 있을 때만 password 옵션 추가
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
});

redisClient.connect()
  .then(() => console.log('✅ Redis connected'))
  .catch(err => console.error('❌ Redis error:', err.message));

// ── 세션 (Redis 저장소) ──────────────────────────
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret:            process.env.SESSION_SECRET || 'dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   1000 * 60 * 60 * 24, // 1일
  },
}));

// ── 라우터 ────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', redis: redisClient.isReady });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 예시: DB 조회
app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users LIMIT 10');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 예시: Redis 캐시
app.get('/api/cache/:key', async (req, res) => {
  const value = await redisClient.get(req.params.key);
  res.json({ key: req.params.key, value });
});

app.set('/api/cache/:key', async (req, res) => {
  await redisClient.set(req.params.key, req.body.value, { EX: 3600 });
  res.json({ ok: true });
});



// ── 서버 시작 ─────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));