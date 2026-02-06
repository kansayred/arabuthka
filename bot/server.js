// Загружаем .env только локально (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

// =============================================
// ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// Проверяем наличие критичных переменных при старте.
// Если чего-то нет — падаем сразу с понятной ошибкой,
// а не крэшимся при первом запросе к БД.
// =============================================
const REQUIRED_ENV = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Переменная окружения ${key} не задана!`);
    console.error('Установите все необходимые переменные в .env (локально) или в Railway.');
    process.exit(1);
  }
}

console.log('✅ Все необходимые переменные окружения присутствуют');

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();

// =============================================
// TRUST PROXY
// Railway работает за прокси, без этой настройки
// rate limiter видит IP прокси вместо клиента —
// все пользователи делят один лимит на всех.
// =============================================
app.set('trust proxy', 1);

// =============================================
// CORS — безопасный доступ для фронтенда
// Поддерживаются:
// - Production-домены Vercel (arabutka/arabuthka)
// - Preview-деплои Vercel (*-vercel.app)
// - Railway-домен (если задан)
// - Telegram WebView (запросы без origin)
// =============================================

// Список точных разрешённых доменов
const allowedOrigins = [
  'https://arabutka-webapp.vercel.app',
  'https://arabuthka-webapp.vercel.app'
];

// Добавляем Railway-домен, если он задан в переменных
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}

// Проверяет, является ли origin Vercel preview-деплоем
function isVercelPreview(origin) {
  // Паттерн: https://<project>-<random>.vercel.app
  return origin && /^https:\/\/[\w-]+-[\w]+\.vercel\.app$/.test(origin);
}

// Определяем, разрешён ли origin
function isOriginAllowed(origin) {
  // Telegram WebView отправляет запросы без origin
  if (!origin) return true;
  // Проверяем точное совпадение
  if (allowedOrigins.includes(origin)) return true;
  // Проверяем Vercel preview-деплои
  if (isVercelPreview(origin)) return true;
  return false;
}

// Локально разрешаем всё для удобства разработки
if (!process.env.RAILWAY_ENVIRONMENT) {
  app.use(cors());
} else {
  app.use(cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS заблокирован: ${origin}`);
        callback(new Error('Запрещено CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data']
  }));
}
}

app.use(express.json());

// =============================================
// ЗАЩИТА ОТ СПАМА (RATE LIMIT)

// =============================================
// ЛОГИРОВАНИЕ ЗАПРОСОВ
// Простой логгер для отладки и мониторинга.
// Логирует метод, URL, статус и время ответа.
// В production можно заменить на morgan или pino.
// =============================================
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  // Логируем после завершения запроса
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Цветной вывод в зависимости от статуса
    let statusIcon = '✅';
    if (statusCode >= 400 && statusCode < 500) statusIcon = '⚠️';
    if (statusCode >= 500) statusIcon = '❌';

    console.log(`${statusIcon} ${method} ${url} ${statusCode} - ${duration}ms`);
  });

  next();
});
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

// Максимальный возраст initData в секундах (24 часа).
// Защищает от replay-атак: если кто-то перехватит initData,
// его нельзя будет использовать спустя сутки.
const MAX_AUTH_AGE_SECONDS = 86400;

function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Проверка свежести auth_date — защита от replay-атак
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authTimestamp > MAX_AUTH_AGE_SECONDS) {
        console.log('⚠️ initData устарела (старше 24 часов)');
        return null;
      }
    }

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
      return { user, authDate };
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

// ---------------------------------------------
// ИНИЦИАЛИЗАЦИЯ БД С ПОВТОРНЫМИ ПОПЫТКАМИ
// На Railway PostgreSQL может быть не сразу доступен при старте.
// Даём 5 попыток с нарастающей задержкой (2с, 4с, 8с, 16с, 32с),
// чтобы сервис успел подняться.
// ---------------------------------------------
async function initDatabase(retries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tracks (
          id SERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          cloudinary_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id)');
      console.log('✅ Таблица tracks готова (попытка ' + attempt + ')');
      return; // Успех — выходим
    } catch (err) {
      console.error(`❌ Попытка ${attempt}/${retries} — не удалось подключиться к БД:`, err.message);
      if (attempt === retries) {
        console.error('🚨 Все попытки исчерпаны. БД недоступна, но сервер продолжит работу.');
        console.error('Эндпоинты, зависящие от БД, будут возвращать ошибку 503.');
        return;
      }
      // Ждём перед следующей попыткой (экспоненциальная задержка)
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`⏳ Следующая попытка через ${waitTime / 1000} секунд...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Запускаем инициализацию БД
initDatabase();

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
// HEALTH-CHECK ЭНДПОИНТ
// Railway использует его для мониторинга состояния сервиса.
// Проверяет соединение с PostgreSQL — если БД недоступна,
// возвращает 503 (Service Unavailable).
// =============================================
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      timestamp: result.rows[0].now,
      uptime: process.uptime()
    });
  } catch (err) {
    console.error('❌ Health-check: БД недоступна:', err.message);
    res.status(503).json({
      status: 'error',
      error: 'База данных недоступна'
    });
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
    // Параметры пагинации с дефолтными значениями
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Проверка корректности параметров
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Неверные параметры: page >= 1, limit должен быть от 1 до 100' 
      });
    }

    // Получаем общее количество треков для пагинации
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM tracks WHERE user_id = $1',
      [req.userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Получаем треки с лимитом и смещением
    const result = await pool.query(
      'SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.userId, limit, offset]
    );

    // Возвращаем треки с метаданными пагинации
    res.json({
      tracks: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Ошибка получения треков:', error.message);
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
// Запускаем сервер и сохраняем ссылку для graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

// =============================================
// GRACEFUL SHUTDOWN
// Корректно завершаем работу при получении сигналов завершения:
// - SIGTERM: Railway/Heroku отправляют при деплое/рестарте
// - SIGINT: Ctrl+C в терминале
// Это даёт время завершить активные запросы и закрыть
// соединения с БД вместо мгновенного обрыва.
// =============================================
function gracefulShutdown(signal) {
  console.log(`\n⚠️ Получен ${signal}. Начинаем корректное завершение...`);

  // Прекращаем принимать новые соединения
  server.close(async () => {
    console.log('🔒 HTTP-сервер закрыт');

    try {
      // Закрываем пул соединений с PostgreSQL
      await pool.end();
      console.log('🗄️ Соединения с PostgreSQL закрыты');
    } catch (err) {
      console.error('❌ Ошибка при закрытии БД:', err.message);
    }

    console.log('✅ Сервер успешно завершил работу');
    process.exit(0);
  });

  // Если за 10 секунд не завершились — принудительный выход
  setTimeout(() => {
    console.error('🚨 Таймаут завершения. Принудительный выход.');
    process.exit(1);
  }, 10000);
}

// Подписываемся на сигналы завершения
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
