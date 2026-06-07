require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express       = require('express');
const { Pool }      = require('pg');
const session       = require('express-session');
const cors          = require('cors');
const helmet        = require('helmet');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 미들웨어 ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://webprog-project-front.vercel.app',
      /https:\/\/webprog-project-frontend-.*\.vercel\.app$/,
    ];
    // 로컬 개발환경은 전부 허용
    if (!origin || origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    const isAllowed = allowed.some(a =>
      typeof a === 'string' ? a === origin : a.test(origin)
    );
    callback(isAllowed ? null : new Error('CORS 차단'), isAllowed);
  },
  credentials: true,
}));
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

// ── Redis 연결 (환경에 따라 분기) ─────────────────
let redisClient;

if (process.env.KV_REST_API_URL) {
  const { Redis } = require('@upstash/redis');
  redisClient = new Redis({
    url:   process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  console.log('✅ Redis connected (Upstash)');
} else {
  // 로컬 환경 → Docker Redis
  const redis = require('redis');
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    },
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  });
  redisClient.connect()
    .then(() => console.log('✅ Redis connected (local)'))
    .catch(err => console.error('❌ Redis error:', err.message));
}

// ── 세션 스토어 설정 ──────────────────────────────
let sessionStore;

if (process.env.KV_REST_API_URL) {
  const { Redis } = require('@upstash/redis');
  const Store = require('express-session').Store;

  const upstash = new Redis({
    url:   process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
    automaticDeserialization: false,
  });

  class UpstashStore extends Store {
    get(sid, cb) {
      upstash.get(`sess:${sid}`)
        .then(d => cb(null, d ? JSON.parse(d) : null))
        .catch(cb);
    }
    set(sid, sess, cb) {
      upstash.set(`sess:${sid}`, JSON.stringify(sess), { ex: 86400 })
        .then(() => cb(null))
        .catch(cb);
    }
    destroy(sid, cb) {
      upstash.del(`sess:${sid}`)
        .then(() => cb(null))
        .catch(cb);
    }
  }

  sessionStore = new UpstashStore();
}

// API 캐시 방지 (Vercel Set-Cookie 문제 해결)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ── 세션 ─────────────────────────────────────────
app.use(session({
  store:             sessionStore,
  secret:            process.env.SESSION_SECRET || 'dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production', // 로컬은 false
    httpOnly: true,
    maxAge:   1000 * 60 * 60 * 24,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 크로스 도메인 쿠키 허용
  },
}));

// ── 라우터 ────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const isRedisReady = process.env.KV_REST_API_URL
      ? true
      : redisClient.isReady;
    res.json({ status: 'ok', db: 'connected', redis: isRedisReady });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users LIMIT 10');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cache/:key', async (req, res) => {
  const value = await redisClient.get(req.params.key);
  res.json({ key: req.params.key, value });
});

app.post('/api/cache/:key', async (req, res) => {
  await redisClient.set(req.params.key, req.body.value, { ex: 3600 });
  res.json({ ok: true });
});

// ── 로그인 ────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { id, password } = req.body;

  if (id === process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD) {
    req.session.isLoggedIn = true;
    req.session.save((err) => {  // ← 명시적 저장
      if (err) {
        console.error('세션 저장 오류:', err);
        return res.status(500).json({ ok: false });
      }
      res.json({ ok: true });
    });
  } else {
    res.status(401).json({ ok: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
  }
});

// ── 로그아웃 ──────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ── 세션 확인 ─────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (req.session.isLoggedIn) {
    res.json({ loggedIn: true });
  } else {
    res.status(401).json({ loggedIn: false });
  }
});

// ── 로그인 확인 미들웨어 ──────────────────────────
const requireLogin = (req, res, next) => {
  if (req.session.isLoggedIn) {
    next();
  } else {
    res.status(401).json({ error: '로그인이 필요합니다.' });
  }
};

// ── 게시글 목록 ───────────────────────────────────
app.get('/api/posts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, created_at FROM posts ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 게시글 + 이미지 함께 저장 ─────────────────────
app.post('/api/posts/with-images', requireLogin, async (req, res) => {
  const { title, content, imageUrls } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });

  try {
    // 게시글 저장
    const { rows } = await pool.query(
      'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    const post = rows[0];

    // 이미지 URL 저장
    if (imageUrls && imageUrls.length > 0) {
      for (const img of imageUrls) {
        await pool.query(
          'INSERT INTO post_images (post_id, url, filename, mimetype) VALUES ($1, $2, $3, $4)',
          [post.id, img.url, img.filename, img.mimetype]
        );
      }
    }

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 게시글 상세 ───────────────────────────────────
app.get('/api/posts/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM posts WHERE id = $1', [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    const { rows: images } = await pool.query(
      'SELECT * FROM post_images WHERE post_id = $1', [req.params.id]
    );
    res.json({ ...rows[0], images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 게시글 작성 (로그인 필요) ─────────────────────
app.post('/api/posts', requireLogin, async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 게시글 삭제 (로그인 필요) ─────────────────────
app.delete('/api/posts/:id', requireLogin, async (req, res) => {
  try {
    await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 사진 업로드 (로그인 필요) ─────────────────────
const multer = require('multer');
const { put } = require('@vercel/blob');

const upload = multer({
  storage: multer.memoryStorage(),  // 메모리에 임시 저장
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB 제한
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

app.post('/api/upload', requireLogin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

    const { originalname, buffer, mimetype } = req.file;

    // 원본 그대로 업로드
    const blob = await put(originalname, buffer, {
      access: 'public',
      contentType: mimetype,
      token: process.env.BLOB_READ_WRITE_TOKEN,  // 로컬 오류로 인해 직접 전달로 변경
    });

    res.json({ url: blob.url, filename: originalname, mimetype });
  } catch (err) {
    console.error('❌ Upload error:', err.message); // ← 추가
    res.status(500).json({ error: err.message });
  }
});

// test
app.get('/api/test-cookie', (req, res) => {
  res.cookie('test', 'hello', {
    sameSite: 'none',
    secure: true,
    httpOnly: true,
  });
  res.json({ ok: true });
});

// ── 서버 시작 ─────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));