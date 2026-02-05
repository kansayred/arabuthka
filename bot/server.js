// Загружаем .env только локально (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();

// =============================================
// CORS — только наш фронтенд
// =============================================

const allowedOrigins = [
  'https://arabutka-webapp.vercel.app',
  'https://arabuthka-webapp.vercel.app'
];

// Локально разрешаем всё для удобства разработки
if (!process.env.RAILWAY_ENVIRONMENT) {
  app.use(cors());
} else {
  app.use(cors({
    origin: function (origin, callback) {
      // Разрешаем запросы без origin (Telegram WebView)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Запрещено CORS'));
      }
    }
  }));
}

app.use(express.json());

// =============================================
// ЗАЩИТА ОТ СПАМА (RATE LIMIT)
// =============================================

// Общий лимит — 100 запросов за 15 минут с одного IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Слишком много запросов, подожди немного' }
});

// Для загрузки строже — 10 файлов за 15 минут
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много загрузок, попробуй позже' }
});

app.use(generalLimiter);

// =============================================
// ПРОВЕРКА TELEGRAM INIT DATA
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
      console.log('❌ Неверная подпись initData');
      return null;
    }

    const userStr = params.get('user');
    if (userStr) {
      const user = JSON.parse(decodeURIComponent(userStr));
      return { user, authDate: params.get('auth_date') };
    }
    return null;
  } catch (err) {
    console.log('Ошибка валидации initData:', err.message);
    return null;
  }
}

function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.query.initData;
  const validated = validateInitData(initData);

  if (!validated) {
    return res.status(401).json({ error: 'Нет доступа — неверный initData' });
  }

  req.telegramUser = validated.user;
  req.userId = validated.user.id;
  next();
}

// =============================================
// БАЗА ДАННЫХ
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
  .then(() => console.log('✅ Таблица tracks готова'))
  .catch(err => console.log('Ошибка создания таблицы:', err));

// =============================================
// CLOUDINARY
// =============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// =============================================
// ЗАГРУЗКА ФАЙЛОВ — лимиты и проверка формата
// =============================================

// Разрешённые аудиоформаты
const ALLOWED_MIMES = [
  'audio/mpeg',       // .mp3
  'audio/wav',        // .wav
  'audio/wave',       // .wav (альтернативный MIME)
  'audio/x-wav',      // .wav (ещё один вариант)
  'audio/ogg',        // .ogg
  'audio/mp4',        // .m4a
  'audio/x-m4a',      // .m4a (альтернативный MIME)
  'audio/aac'         // .aac
];

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];

// Максимум 25 МБ на файл
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Проверяем MIME-тип
    const isMimeOk = ALLOWED_MIMES.includes(file.mimetype);

    // Проверяем расширение
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    const isExtOk = ALLOWED_EXTENSIONS.includes(ext);

    if (isMimeOk || isExtOk) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат. Разрешены: MP3, WAV, OGG, M4A, AAC'));
    }
  }
});

// =============================================
// ЗАЩИЩЁННЫЕ API-ЭНДПОИНТЫ
// =============================================

app.post('/upload', uploadLimiter, authMiddleware, upload.single('track'), async (req, res) => {
  try {
    // Если файл не пришёл
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не прикреплён' });
    }

    const userId = req.userId;
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: `arabutka/${userId}` },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    // Убираем расширение из названия
    const originalName = req.file.originalname;
    const name = originalName.replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '');

    const dbResult = await pool.query(
      'INSERT INTO tracks (user_id, name, url, cloudinary_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, name, uploadResult.secure_url, uploadResult.public_id]
    );
    res.json({ success: true, track: dbResult.rows[0] });
  } catch (error) {
    console.log('Ошибка загрузки:', error.message);

    // Понятное сообщение при превышении лимита
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой (максимум 25 МБ)' });
    }
    res.status(500).json({ error: error.message || 'Ошибка загрузки' });
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
    res.status(500).json({ error: 'Не удалось получить треки' });
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
      return res.status(404).json({ success: false, error: 'Трек не найден' });
    }

    if (track.rows[0].cloudinary_id) {
      await cloudinary.uploader.destroy(track.rows[0].cloudinary_id, { resource_type: 'video' });
    }

    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Ошибка удаления' });
  }
});

app.get('/', (req, res) => res.send('Arabutka API работает 🎵'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
