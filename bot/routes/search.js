// =============================================
// SEARCH ROUTES
// Маршруты для поиска и скачивания треков
// =============================================

const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const musicSearch = require('../services/musicSearch');
const cobaltDownloader = require('../services/cobaltDownloader');
const pool = require('../db/pool');
const { createAuthMiddleware } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

// =============================================
// КОНФИГУРАЦИЯ
// =============================================

const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const MAX_CACHE_SIZE = 1000; // максимум 1000 запросов в кеше
const MAX_QUERY_LENGTH = 200; // максимальная длина поискового запроса
const MAX_LIMIT = 50; // максимальное количество результатов
const DEFAULT_LIMIT = 20; // количество результатов по умолчанию

// =============================================
// MIDDLEWARE
// =============================================

const authMiddleware = createAuthMiddleware(process.env.TELEGRAM_BOT_TOKEN);

// Rate limiting: 20 запросов в минуту на поиск
const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  maxRequests: 20,
  message: 'Слишком много запросов. Попробуйте позже'
});

// Rate limiting для скачивания: 5 запросов в минуту
const downloadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Слишком много запросов на скачивание. Попробуйте позже'
});

// =============================================
// КЕШИРОВАНИЕ РЕЗУЛЬТАТОВ ПОИСКА
// =============================================

const searchCache = new Map();

function getCacheKey(query, limit) {
  return `${query.toLowerCase().trim()}_${limit}`;
}

function getFromCache(key) {
  const cached = searchCache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(key, data) {
  searchCache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  if (searchCache.size > MAX_CACHE_SIZE) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
}

// =============================================
// ВАЛИДАЦИЯ
// =============================================

function validateSearchQuery(q) {
  if (!q || typeof q !== 'string') {
    return { valid: false, error: 'Параметр q обязателен и должен быть строкой' };
  }
  
  const trimmed = q.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Поисковый запрос не может быть пустым' };
  }
  
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: `Запрос слишком длинный (максимум ${MAX_QUERY_LENGTH} символов)` };
  }
  
  return { valid: true, query: trimmed };
}

function validateLimit(limit) {
  const num = parseInt(limit, 10);
  if (isNaN(num) || num < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(num, MAX_LIMIT);
}

// =============================================
// УТИЛИТЫ
// =============================================

function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

function logInfo(message, data = {}) {
  console.log(`ℹ️ [Search] ${message}`, JSON.stringify(data));
}

function logError(message, error) {
  console.error(`❌ [Search] ${message}:`, error.message);
  if (error.stack) {
    console.error(error.stack);
  }
}

// =============================================
// РОУТЫ
// =============================================

// ---------------------------------------------
// Поиск по всем трекам (скачанные + доступные)
// ---------------------------------------------
router.get('/search/all', authMiddleware, searchRateLimiter, async (req, res) => {
  try {
    const { q, limit = DEFAULT_LIMIT } = req.query;
    const userId = req.userId;
    
    // Валидация
    const validation = validateSearchQuery(q);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const validatedLimit = validateLimit(limit);
    logInfo('Поиск по всем трекам', { userId, query: validation.query, limit: validatedLimit });
    
    // 1. Ищем в скачанных треках пользователя
    const escapedQ = escapeLike(validation.query);
    const myTracksResult = await pool.query(
      `SELECT id, name as title, url, created_at, 'my_library' as source, true as is_downloaded
       FROM tracks 
       WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, `%${escapedQ}%`, validatedLimit]
    );
    
    const myTracks = myTracksResult.rows.map(track => ({
      ...track,
      artist: 'Моя библиотека',
      isDownloaded: true
    }));
    
    // 2. Ищем во внешних источниках
    const externalResult = await musicSearch.searchAllSources(validation.query, validatedLimit);
    
    const externalTracks = externalResult.success 
      ? externalResult.tracks.map(track => ({
          ...track,
          isDownloaded: false
        }))
      : [];
    
    // 3. Объединяем результаты
    const allTracks = [
      ...myTracks,
      ...externalTracks
    ].slice(0, validatedLimit);
    
    logInfo('Поиск завершен', { found: allTracks.length, myLibrary: myTracks.length, external: externalTracks.length });
    
    res.json({
      success: true,
      query: validation.query,
      count: allTracks.length,
      tracks: allTracks,
      stats: {
        myLibrary: myTracks.length,
        external: externalTracks.length,
        sources: externalResult.sources || {}
      }
    });
    
  } catch (error) {
    logError('Ошибка поиска по всем трекам', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ---------------------------------------------
// Поиск только во внешних источниках
// ---------------------------------------------
router.get('/search/external', authMiddleware, async (req, res) => {
  try {
    const { q, limit = DEFAULT_LIMIT } = req.query;
    
    // Валидация, searchRateLimiter
    const validation = validateSearchQuery(q);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const validatedLimit = validateLimit(limit);
    const cacheKey = getCacheKey(validation.query, validatedLimit);
    
    // Проверяем кеш
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      logInfo('Результат из кеша', { query: validation.query });
      return res.json({ ...cachedResult, cached: true });
    }
    
    logInfo('Поиск во внешних источниках', { query: validation.query, limit: validatedLimit });
    
    const result = await musicSearch.searchAllSources(validation.query, validatedLimit);
    
    if (result.success) {
      setCache(cacheKey, result);
      logInfo('Внешний поиск завершен', { found: result.count });
    } else {
      logError('Внешний поиск не удался', new Error(result.error || 'Unknown error'));
    }
    
    res.json(result);
    
  } catch (error) {
    logError('Ошибка внешнего поиска', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ---------------------------------------------
// Скачивание трека из внешнего источника
// ---------------------------------------------
router.post('/search/download', authMiddleware, async (req, res) => {
  try {
    const { title, artist } = req.body;
    const userId = req.userId;
    , downloadRateLimiter
    // Валидация
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Параметр title обязателен и не может быть пустым' });
    }
    
    const sanitizedTitle = title.trim();
    const sanitizedArtist = artist && typeof artist === 'string' ? artist.trim() : '';
    
    if (sanitizedTitle.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ error: `Название трека слишком длинное (максимум ${MAX_QUERY_LENGTH} символов)` });
    }
    
    logInfo('Запрос на скачивание трека', { userId, title: sanitizedTitle, artist: sanitizedArtist });
    
    // Проверяем, не скачан ли уже этот трек
    const searchQuery = sanitizedArtist ? `${sanitizedArtist} - ${sanitizedTitle}` : sanitizedTitle;
    const existingTrack = await pool.query(
      'SELECT id, name, url FROM tracks WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
      [userId, searchQuery]
    );
    
    if (existingTrack.rows.length > 0) {
      logInfo('Трек уже существует в библиотеке', { trackId: existingTrack.rows[0].id });
      return res.json({
        success: true,
        message: 'Этот трек уже есть в вашей библиотеке',
        track: existingTrack.rows[0],
        alreadyExists: true
      });
    }
    
    // Скачиваем полный трек через YouTube + Cobalt/yt-dlp
    logInfo('Начинаем скачивание через Cobalt/yt-dlp', { query: searchQuery });
    const downloadResult = await cobaltDownloader.searchAndDownload(searchQuery);
    
    if (!downloadResult.success) {
      logError('Скачивание не удалось', new Error(downloadResult.error || 'Unknown error'));
      return res.status(500).json({ 
        error: downloadResult.error || 'Не удалось скачать трек',
        details: 'Попробуйте позже или выберите другой трек'
      });
    }
    
    logInfo('Трек скачан, загружаем в Cloudinary', { bufferSize: downloadResult.buffer.length });
    
    // Загружаем в Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video', 
          folder: `arabutka/${userId}`,
          public_id: `${sanitizedTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(downloadResult.buffer);
    });
    
    logInfo('Файл загружен в Cloudinary', { publicId: uploadResult.public_id });
    
    // Сохраняем в БД
    const dbResult = await pool.query(
      'INSERT INTO tracks (user_id, name, url, cloudinary_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, searchQuery, uploadResult.secure_url, uploadResult.public_id]
    );
    
    logInfo('Трек сохранен в БД', { trackId: dbResult.rows[0].id });
    
    res.json({
      success: true,
      message: 'Трек успешно добавлен в вашу библиотеку',
      track: dbResult.rows[0]
    });
    
  } catch (error) {
    logError('Критическая ошибка при скачивании трека', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: 'Пожалуйста, попробуйте позже'
    });
  }
});

module.exports = router;
