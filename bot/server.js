require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблицы с user_id
pool.query(`
  CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    cloudinary_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => {
  // Добавляем индекс для быстрого поиска по user_id
  return pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id)
  `);
}).then(() => console.log('Таблица tracks готова'))
  .catch(err => console.log('Ошибка создания таблицы:', err));

// Настройки Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Загрузка трека (теперь с user_id)
app.post('/upload', upload.single('track'), async (req, res) => {
  try {
    const userId = req.body.user_id || req.query.user_id;

    if (!userId) {
      return res.status(400).json({ error: 'user_id обязателен' });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: `arabutka/${userId}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
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
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

// Получить треки конкретного пользователя
app.get('/tracks', async (req, res) => {
  try {
    const userId = req.query.user_id;

    if (!userId) {
      return res.status(400).json({ error: 'user_id обязателен' });
    }

    const result = await pool.query(
      'SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения треков' });
  }
});

// Удаление трека (с проверкой владельца)
app.delete('/tracks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.user_id;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'user_id обязателен' });
    }

    // Проверяем, что трек принадлежит пользователю
    const track = await pool.query(
      'SELECT * FROM tracks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (track.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Трек не найден или не принадлежит вам' });
    }

    const publicId = track.rows[0].cloudinary_id;
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    }

    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Ошибка удаления' });
  }
});

app.get('/', (req, res) => {
  res.send('Арабутка API работает');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});