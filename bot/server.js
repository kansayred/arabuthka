require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблицы при запуске
pool.query(`
  CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('Таблица tracks готова'))
  .catch(err => console.log('Ошибка создания таблицы:', err));

// Настройки Cloudinary — из переменных окружения
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Хранилище для загрузки
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Загрузка трека
app.post('/upload', upload.single('track'), async (req, res) => {
  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'arabutka' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const name = req.file.originalname.replace('.mp3', '');

    // Сохраняем в базу
    const dbResult = await pool.query(
      'INSERT INTO tracks (name, url, cloudinary_id) VALUES ($1, $2, $3) RETURNING *',
      [name, uploadResult.secure_url, uploadResult.public_id]
    );

    res.json({ success: true, track: dbResult.rows[0] });
  } catch (error) {
    console.log('Upload error:', error);
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

// Получить все треки
app.get('/tracks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tracks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения треков' });
  }
});

// Удаление трека
app.delete('/tracks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const track = await pool.query('SELECT * FROM tracks WHERE id = $1', [id]);
    
    if (track.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Трек не найден' });
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

// Главная страница
app.get('/', (req, res) => {
  res.send('Арабутка API работает');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});