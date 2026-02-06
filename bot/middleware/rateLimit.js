/**
 * Rate Limiting middleware для защиты от спама и DDoS
 * 
 * Использует встроенную память для хранения счётчиков
 * Для production рекомендуется Redis или подобное решение
 */

const logger = require('../utils/logger');
const { ApiError } = require('./errorHandler');

// Хранилище запросов в памяти (Map: IP -> { count, resetTime })
const requestStore = new Map();

// Очистка устаревших записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestStore.entries()) {
    if (now > value.resetTime) {
      requestStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Конфигурация по умолчанию
 */
const DEFAULT_CONFIG = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // Макс запросов
  message: 'Слишком много запросов. Попробуйте позже.',
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
};

/**
 * Создаёт middleware для rate limiting
 * 
 * @param {Object} options - Настройки
 * @param {number} [options.windowMs] - Временное окно в ms
 * @param {number} [options.max] - Макс запросов в окне
 * @param {string} [options.message] - Сообщение при превышении
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return (req, res, next) => {
    const key = config.keyGenerator(req);
    const now = Date.now();

    // Получаем или создаём запись
    let record = requestStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    record.count++;
    requestStore.set(key, record);

    // Добавляем заголовки для клиента
    res.set('X-RateLimit-Limit', config.max);
    res.set('X-RateLimit-Remaining', Math.max(0, config.max - record.count));
    res.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    // Проверяем лимит
    if (record.count > config.max) {
      logger.warn('Превышен rate limit', {
        ip: key,
        count: record.count,
        limit: config.max,
        url: req.originalUrl
      });

      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter);
      
      return next(ApiError.tooManyRequests(config.message));
    }

    next();
  };
}

/**
 * Строгий rate limiter для чувствительных эндпоинтов (например, аутентификация)
 */
const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // Только 5 попыток
  message: 'Слишком много попыток. Подождите 15 минут.'
});

/**
 * Стандартный rate limiter для API
 */
const apiLimiter = createRateLimiter();

/**
 * Мягкий rate limiter для публичных эндпоинтов
 */
const softLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: 60, // 60 запросов в минуту
  message: 'Слишком частые запросы. Подождите минуту.'
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  strictLimiter,
  softLimiter
};
