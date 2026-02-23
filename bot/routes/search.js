// =============================================
// SEARCH ROUTES
// Маршруты для поиска и скачивания треков
// =============================================

const express = require('express');
const router = express.Router();
const musicSearch = require('../services/musicSearch');
const pool = require('../db/pool');
const { createAuthMiddleware } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

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
  searchCache.set(key, { data, timestamp: Date.now() });

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
  logger.info(`[Search] ${message}`, data);
}

function logError(message, error) {
  logger.error(`[Search] ${message}:`, error.message);
  if (error.stack) {
    logger.error(error.stack);
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
      ? externalResult.tracks.map(track => ({ ...track, isDownloaded: false }))
      : [];

    // 3. Объединяем результаты
    const allTracks = [
      ...myTracks,
      ...externalTracks
    ].slice(0, validatedLimit);

    logInfo('Поиск завершен', {
      found: allTracks.length,
      myLibrary: myTracks.length,
      external: externalTracks.length
    });

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
router.get('/search/external', authMiddleware, searchRateLimiter, async (req, res) => {
  try {
    const { q, limit = DEFAULT_LIMIT } = req.query;

    // Валидация
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
router.post('/search/download', authMiddleware, downloadRateLimiter, async (req, res) => {
  // =============================================
  // ЗАГЛУШКА: Функция скачивания треков временно недоступна
  // Причина: Подготовка к первым инвестициям и MVP.
  //
  // Политика проекта: до заключения контрактов с лейблами
  // пользователи могут загружать только собственные треки
  // через endpoint /upload.
  //
  // TODO (после заключения контрактов):
  // 1. Интегрировать API лейблов для легального доступа к каталогу
  // 2. Реализовать полноценный поиск и скачивание с лицензированными треками
  // 3. Добавить редактирование метаданных (для подписки AraMax)
  // 4. Стандартизировать форматы и качество треков
  // =============================================

  logInfo('Запрос на скачивание трека (заглушка)', { userId: req.userId });

  res.status(501).json({
    success: false,
    error: 'Функция скачивания временно недоступна',
    message: 'Для подготовки к инвестициям функция скачивания треков из внешних источников временно отключена. Вы можете загружать собственные треки через функцию загрузки.',
    details: 'После заключения контрактов с лейблами функция будет возобновлена с полным доступом к лицензированным трекам.',
    availableActions: [
      'Загрузить собственные треки через /upload',
      'Использовать поиск по вашей библиотеке'
    ]
  });
});

module.exports = router;
