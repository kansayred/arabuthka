// Загружаем .env только для локальной разработки
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// =============================================
// TELEGRAM INIT DATA VALIDATION
// =============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    if (calculatedHash !== hash) {
      console.log('Invalid initData signature');
      return null;
    }

    const userStr = params.get('user');
    if (userStr) {
      const user = JSON.parse(decodeURIComponent(userStr));
      return { user, authDate: params.get('auth_date') };
    }
    return null;
  } catch (err) {
    console.log('initData validation error:', err.message);
    return null;
  }
}

function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.query.initData;
  const validated = validateInitData(initData);

  if (!validated) {
    return res.status(401).json({ error: 'Unauthorized: invalid initData' });
  }

  req.telegramUser = validated.user;
  req.userId = validated.user.id;
  next();
}

// =============================================
// DATABASE
// =============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    cloudinary_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id)`))
  .then(() => console.log('Table tracks ready'))
  .catch(err => console.log('Table creation error:', err));

// =============================================
// CLOUDINARY
// =============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// =============================================
// PROTECTED API ENDPOINTS
// =============================================

app.post('/upload', authMiddleware, upload.single('track'), async (req, res) => {
  try {
    const userId = req.userId;
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: `arabutka/${userId}` },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const name = req.file.originalname.replace('.mp3', '');
    const dbResult = await pool.query(
      'INSERT INTO tracks (user_id, name, url, cloudinary_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, name, uploadResult.secure_url, uploadResult.public_id]
    );
    res.json({ success: true, track: dbResult.rows[0] });
  } catch (error) {
    console.log('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/tracks', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tracks' });
  }
});

app.delete('/tracks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const track = await pool.query(
      'SELECT * FROM tracks WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (track.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    if (track.rows[0].cloudinary_id) {
      await cloudinary.uploader.destroy(track.rows[0].cloudinary_id, { resource_type: 'video' });
    }

    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

app.get('/', (req, res) => res.send('Arabutka API is running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
