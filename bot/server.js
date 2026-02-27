// Загружаем .env только локально (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

// =============================================
// ЦЕНТРАЛИЗОВАННОЕ ЛОГИРОВАНИЕ
// =============================================
const logger = require('./utils/logger');
const axios = require('axios');

// =============================================
// ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// Проверяем наличие критичных переменных при старте.
// Если чего-то нет — падаем сразу с понятной ошибкой,
// а не крэшимся при первом запросе к БД.
// =============================================

const REQUIRED_ENV = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
    'S3_ACCESS_KEY',
  'S3_SECRET_KEY'
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`КРИТИЧЕСКАЯ ОШИБКА: Переменная окружения ${key} не задана!`);
    logger.error('Установите все необходимые переменные в .env (локально) или в Railway.');
    process.exit(1);
  }
}
logger.info('Все необходимые переменные окружения присутствуют');

const express = require('express');
const multer = require('multer');
const { uploadToS3, deleteFromS3, getFromS3 } = require('./services/s3');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// =============================================
// МОНИТОРИНГ И АНАЛИТИКА
// =============================================
const sentry = require('./monitoring/sentry');
sentry.init(app);

// =============================================
// БАЗА ДАННЫХ — импорт единого пула
// =============================================
const pool = require('./db/pool');

// =============================================
// АВТОРИЗАЦИЯ — импорт модульной auth
// =============================================
const { createAuthMiddleware } = require('./middleware/auth');
const authMiddleware = createAuthMiddleware(process.env.TELEGRAM_BOT_TOKEN);

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
// - Preview-деплои Vercel с именем проекта (arabuthka/arabutka)
// - Railway-домен (если задан)
// - Telegram WebView (запросы без origin)
// =============================================
const allowedOrigins = [
  'https://arabutka-webapp.vercel.app',
  'https://arabuthka-webapp.vercel.app'
];

if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}

// Проверяет, является ли origin Vercel preview-деплоем с именем проекта
function isVercelPreview(origin) {
  // Паттерн: https://(arabuthka|arabutka)-<hash>-<team>.vercel.app
  return origin && /^https:\/\/(arabuthka|arabutka)-[\w-]+\.vercel\.app$/.test(origin);
}

function isOriginAllowed(origin) {
  if (!origin) return true; // Telegram WebView
  if (allowedOrigins.includes(origin)) return true;
  if (isVercelPreview(origin)) return true;
  return false;
}

if (!process.env.RAILWAY_ENVIRONMENT) {
  app.use(cors());
} else {
  app.use(cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS заблокирован: ${origin}`);
        callback(new Error('Запрещено CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data']
  }));
}

app.use(express.json());

// =============================================
// SECURITY HEADERS (helmet)
// Автоматическая установка защитных HTTP-заголовков.
// Включает: X-Content-Type-Options, X-Frame-Options,
// X-XSS-Protection, и др. Убирает X-Powered-By.
// =============================================
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: false, // CSP отключён — Telegram WebApp требует inline-скрипты
  crossOriginEmbedderPolicy: false // Telegram WebView не поддерживает COEP
}));
app.use((req, res, next) => {
    // Не блокируем кэширование для стриминга аудио
  if (req.path.startsWith('/stream')) return next();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// =============================================
// ЛОГИРОВАНИЕ ЗАПРОСОВ
// Используем централизованный logger для структурированных логов.
// В production выводит JSON для удобного парсинга.
// =============================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req, res.statusCode, duration);
  });
  next();
});

// =============================================
// RATE LIMITING
// =============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Слишком много запросов, подожди немного' }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много загрузок, попробуй позже' }
});

app.use(generalLimiter);

// =============================================
// ИНИЦИАЛИЗАЦИЯ БД С ПОВТОРНЫМИ ПОПЫТКАМИ
// На Railway PostgreSQL может быть не сразу доступен при старте.
// Даём 5 попыток с нарастающей задержкой (2с, 4с, 8с, 16с, 32с).
// =============================================
async function initDatabase(retries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tracks (
          id SERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          s3_key TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Составной индекс (user_id, created_at DESC) ускоряет запрос /tracks,
      // который фильтрует по user_id И сортирует по created_at DESC.
      // Без этого PostgreSQL выполняет дополнительную сортировку в памяти.
      await pool.query('CREATE INDEX IF NOT EXISTS idx_tracks_user_created ON tracks(user_id, created_at DESC)');
      
      // Таблицы плейлистов
      await pool.query(`
        CREATE TABLE IF NOT EXISTS playlists (
          id SERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS playlist_tracks (
          id SERIAL PRIMARY KEY,
          playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
          track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(playlist_id, track_id)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position)');
      logger.info('Таблицы playlists и playlist_tracks готовы');
      logger.info(`Таблица tracks готова (попытка ${attempt})`);
      return;
    } catch (err) {
      logger.error(`Попытка ${attempt}/${retries} - не удалось подключиться к БД`, err);
      if (attempt === retries) {
        logger.error('Все попытки исчерпаны. БД недоступна, но сервер продолжит работу.');
        logger.error('Эндпоинты, зависящие от БД, будут возвращать ошибку 503.');
        return;
      }
      const waitTime = delay * Math.pow(2, attempt - 1);
      logger.info(`Следующая попытка через ${waitTime / 1000} секунд...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

initDatabase();


// =============================================
// ЗАГРУЗКА ФАЙЛОВ — лимиты и проверка формата
// =============================================
const ALLOWED_MIMES = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const isMimeOk = ALLOWED_MIMES.includes(file.mimetype);
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    const isExtOk = ALLOWED_EXTENSIONS.includes(ext);
    if (isMimeOk && isExtOk) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат. Разрешены: MP3, WAV, OGG, M4A, AAC'));
    }
  }
});

// =============================================
// HEALTH-CHECK ЭНДПОИНТ
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
    logger.error('Health-check: БД недоступна', err);
    res.status(503).json({
      status: 'error',
      error: 'База данных недоступна'
    });
  }
});

// =============================================
// МАРШРУТЫ ПОИСКА
// =============================================
const searchRoutes = require('./routes/search');
app.use('/api', searchRoutes);

// =============================================
// МАРШРУТЫ ПЛЕЙЛИСТОВ
// =============================================
const playlistRoutes = require('./routes/playlists');
app.use('/playlists', authMiddleware, playlistRoutes);

// =============================================
// ЗАЩИЩЁННЫЕ API-ЭНДПОИНТЫ
// =============================================
app.post('/upload', uploadLimiter, authMiddleware, upload.single('track'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не прикреплён' });
    }

    const userId = req.userId;
    logger.userAction(userId, 'upload_start', { filename: req.file.originalname, size: req.file.size });

        // Загрузка в Selectel S3
    const s3Key = `arabutka/${userId}/track_${Date.now()}`;
    const fileUrl = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype || 'audio/mpeg');

    const originalName = req.file.originalname;
    const name = originalName.replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '');

    const dbResult = await pool.query(
      'INSERT INTO tracks (user_id, name, url, s3_key) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, name, fileUrl, s3Key]
    );

    logger.userAction(userId, 'upload_success', { trackId: dbResult.rows[0].id, name });
    res.json({ success: true, track: dbResult.rows[0] });
  } catch (error) {
    logger.error('Ошибка загрузки', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой (максимум 25 МБ)' });
    }
    res.status(500).json({ error: error.message || 'Ошибка загрузки' });
  }
});

app.get('/tracks', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Неверные параметры: page >= 1, limit должен быть от 1 до 100' });
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM tracks WHERE user_id = $1', [req.userId]);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.userId, limit, offset]
    );

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
    logger.error('Ошибка получения треков', error);
    res.status(500).json({ error: 'Не удалось получить треки' });
  }
});

app.delete('/tracks/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
        if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Неверный ID' });
    const track = await pool.query('SELECT * FROM tracks WHERE id = $1 AND user_id = $2', [id, req.userId]);

    if (track.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Трек не найден' });
    }

    if (track.rows[0].s3_key) {
            await deleteFromS3(track.rows[0].s3_key);
    }

    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);
    logger.userAction(req.userId, 'track_deleted', { trackId: id });
    res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка удаления', err);
    res.status(500).json({ success: false, error: 'Ошибка удаления' });
  }
  });
app.get('/', (req, res) => res.send('Arabutka API работает'));

// === DEBUG-эндпоинты только для локальной разработки ===
if (!process.env.RAILWAY_ENVIRONMENT) {

  // ==============================================
// ДИАГНОСТИКА ТРЕКОВ (временный endpoint)
// ==============================================
app.get('/debug/tracks', async (req, res) => {
  try {
    const result = await pool.query(
            'SELECT id, name, url, s3_key, created_at FROM tracks ORDER BY id');
      
    const tracks = result.rows.map(t => ({
      id: t.id,
      name: t.name,
      has_s3_key: !!t.s3_key,
      s3_key: t.s3_key || null,
      url_type: t.url ? (t.url.includes('cloudinary') ? 'cloudinary' : t.url.includes('selcloud') ? 's3' : 'other') : 'none',
      url_preview: t.url ? t.url.substring(0, 80) + '...' : null
    }));
    res.json({ count: tracks.length, tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ==============================================
// СТРИМИНГ АУДИО — прокси через сервер

// Временный эндпоинт для диагностики S3 бакета
app.get('/debug/s3-list', async (req, res) => {
  try {
    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'https://s3.ru-1.storage.selcloud.ru',
      region: 'ru-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
      },
      forcePathStyle: true
    });
    const bucket = process.env.S3_BUCKET_NAME || 'maneshkin';
    const prefix = req.query.prefix || 'arabutka/';
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 100
    }));
    const objects = (response.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));
    res.json({ bucket, prefix, count: objects.length, objects });
  } catch (err) {
    res.status(500).json({ error: err.message, name: err.name });
  }
});

// Временный: удаление орфанных треков (файлы не существуют в S3)
app.delete('/debug/cleanup-orphans', async (req, res) => {
  try {
    const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'https://s3.ru-1.storage.selcloud.ru',
      region: 'ru-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
      },
      forcePathStyle: true
    });
    const bucket = process.env.S3_BUCKET_NAME || 'maneshkin';
    const allTracks = await pool.query('SELECT id, name, s3_key FROM tracks');
    const orphans = [];
    for (const track of allTracks.rows) {
      if (!track.s3_key) { orphans.push(track); continue; }
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: track.s3_key }));
      } catch (err) {
        if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
          orphans.push(track);
        }
      }
    }
    if (orphans.length === 0) {
      return res.json({ message: 'Орфанных треков нет', deleted: 0 });
    }
    const ids = orphans.map(t => t.id);
    await pool.query('DELETE FROM tracks WHERE id = ANY($1)', [ids]);
    res.json({ message: `Удалено ${orphans.length} орфанных треков`, deleted: orphans.length, orphans: orphans.map(t => ({ id: t.id, name: t.name, s3_key: t.s3_key })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
} // конец if (!RAILWAY_ENVIRONMENT)
// Фронтенд запрашивает /stream/:trackId,
// сервер берёт s3_key из БД и проксирует файл из S3.
// Это обходит CORS-ограничения Selectel.
// ==============================================
app.get('/stream/:trackId', authMiddleware, async (req, res) => {
  try {
    const trackId = parseInt(req.params.trackId);
        if (isNaN(trackId) || trackId < 1) return res.status(400).json({ error: 'Неверный ID трека' });
    const result = await pool.query(
      'SELECT s3_key, name, url FROM tracks WHERE id = $1 AND user_id = $2',
      [trackId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    const { s3_key, name, url } = result.rows[0];

// Нет s3_key — проксируем через axios (старые треки, бакет приватный)
    if (!s3_key) {
      if (!url) return res.status(404).json({ error: 'Файл не найден в хранилище' });
      logger.warn(`[stream] Нет s3_key для трека ${trackId}, проксируем url`);
            // SSRF-защита: проверяем URL перед проксированием
      const parsedUrl = new URL(url);
      const allowedHosts = ['selcloud.ru', 'cloudinary.com', 'res.cloudinary.com'];
      if (!allowedHosts.some(h => parsedUrl.hostname.endsWith(h))) {
        logger.error(`[stream] SSRF blocked: ${url}`);
        return res.status(403).json({ error: 'Запрещённый URL' });
      }
      const axiosRes = await axios.get(url, { responseType: 'stream' });
      res.setHeader('Content-Type', axiosRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}.mp3"`);
      return axiosRes.data.pipe(res);
    }
    try {
      const s3Response = await getFromS3(s3_key);
      res.setHeader('Content-Type', s3Response.ContentType || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');      if (s3Response.ContentLength) res.setHeader('Content-Length', s3Response.ContentLength);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}.mp3"`);
            logger.info(`[stream] S3 response received for key: ${s3_key}, ContentType: ${s3Response.ContentType}, ContentLength: ${s3Response.ContentLength}, BodyType: ${typeof s3Response.Body}, hasPipe: ${typeof s3Response.Body?.pipe}`);
      s3Response.Body.on('error', (err) => {
        logger.error('Ошибка стриминга из S3', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Ошибка воспроизведения' });
        }
      });
            if (typeof s3Response.Body.pipe === 'function') { s3Response.Body.pipe(res); } else { logger.error('[stream] Body has no pipe method, converting to buffer'); const chunks = []; for await (const chunk of s3Response.Body) { chunks.push(chunk); } res.end(Buffer.concat(chunks)); }
      
    } catch (s3Error) {
// S3 не нашёл файл — проксируем через axios (ACL не работает, бакет приватный)
      if (s3Error.name === 'NoSuchKey' || s3Error.name === 'AccessDenied') {
        if (!url) throw s3Error;
        logger.warn(`[stream] ${s3Error.name} для ${s3_key}, проксируем url`);
                  // SSRF-защита: проверяем URL перед проксированием
          const fallbackUrl = new URL(url);
          const safeHosts = ['selcloud.ru', 'cloudinary.com', 'res.cloudinary.com'];
          if (!safeHosts.some(h => fallbackUrl.hostname.endsWith(h))) {
            logger.error(`[stream] SSRF blocked in fallback: ${url}`);
            throw new Error('SSRF blocked');
          }
        const axiosRes = await axios.get(url, { responseType: 'stream' });
        res.setHeader('Content-Type', axiosRes.headers['content-type'] || 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}.mp3"`);
        return axiosRes.data.pipe(res);
      }
      throw s3Error;
    }
  } catch (error) {
        logger.error('Ошибка в /stream/:trackId', { trackId: req.params.trackId, error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Ошибка воспроизведения', detail: error.message });
  }
});

const PORT = process.env.PORT || 3000;

// Обработка 404 — маршрут не найден
app.use((req, res) => {
  res.status(404).json({
    error: 'Маршрут не найден',
    path: req.path,
    method: req.method
  });
});

// =============================================
// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// Перехватывает все необработанные ошибки в маршрутах.
// Возвращает понятный JSON-ответ вместо HTML-страницы ошибки.
// =============================================
app.use((err, req, res, next) => {
  logger.error('Ошибка в маршруте', err);

  const statusCode = err.status || err.statusCode || 500;
  const response = {
    error: err.message || 'Внутренняя ошибка сервера',
    status: statusCode
  };

  if (!process.env.RAILWAY_ENVIRONMENT) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

// =============================================
// ЗАПУСК СЕРВЕРА
// =============================================
const server = app.listen(PORT, () => {
  logger.info(`Сервер запущен на порту ${PORT}`);
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
  logger.warn(`Получен ${signal}. Начинаем корректное завершение...`);

  server.close(async () => {
    logger.info('HTTP-сервер закрыт');
    try {
      await pool.end();
      logger.info('Соединения с PostgreSQL закрыты');
    } catch (err) {
      logger.error('Ошибка при закрытии БД', err);
    }
    logger.info('Сервер успешно завершил работу');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Таймаут завершения. Принудительный выход.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================
// ПЕРЕХВАТ НЕОБРАБОТАННЫХ ОШИБОК
// Без этих обработчиков любой необработанный промис или исключение
// молча убивает процесс на Railway без логирования причины.
// Теперь: логируем ошибку, отправляем в Sentry и завершаем корректно.
// =============================================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('НЕОБРАБОТАННЫЙ ПРОМИС', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('НЕОБРАБОТАННОЕ ИСКЛЮЧЕНИЕ', error);
  gracefulShutdown('uncaughtException');
});
