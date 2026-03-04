// ==============================================
// МОДУЛЬ АВТОРИЗАЦИИ TELEGRAM
// Проверка и валидация initData от Telegram WebApp
// + серверная авторизация бот → API (X-Bot-Secret)
// ==============================================

const crypto = require('crypto');
const logger = require('../utils/logger');

// Максимальный возраст initData в секундах (24 часа)
// Защищает от replay-атак: старые токены не принимаются
const MAX_AUTH_AGE_SECONDS = 86400;

/**
 * Проверяет подлинность initData от Telegram
 * @param {string} initData - Строка initData из Telegram WebApp
 * @param {string} botToken - Токен бота
 * @returns {Object|null} - Данные пользователя или null при ошибке
 */
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Проверка свежести auth_date
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authTimestamp > MAX_AUTH_AGE_SECONDS) {
        logger.warn('initData устарела (старше 24 часов)');
        return null;
      }
      // Защита от подделки timestamp в будущем (+60с допуск на рассинхрон часов)
      if (authTimestamp > now + 60) {
        logger.warn('initData из будущего — возможна подделка timestamp');
        return null;
      }
    }

    // Сортируем параметры и формируем строку для проверки
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем HMAC-подпись
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    // Timing-safe сравнение для защиты от timing-атак
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    const hashBuf = Buffer.from(hash || '', 'hex');

    if (calcBuf.length !== hashBuf.length || !crypto.timingSafeEqual(calcBuf, hashBuf)) {
      logger.warn('Неверная подпись initData');
      return null;
    }

    // Извлекаем данные пользователя
    const userStr = params.get('user');
    if (userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        return { user, authDate };
      } catch (parseErr) {
        logger.error('Ошибка парсинга user из initData', { error: parseErr.message });
        return null;
      }
    }

    return null;
  } catch (err) {
    logger.error('Ошибка валидации initData', { error: err.message });
    return null;
  }
}

/**
 * Проверяет серверный вызов от Telegram-бота.
 * Бот отправляет X-Bot-Secret (HMAC токена) + X-Telegram-User-Id.
 * Это позволяет боту вызывать API от имени пользователя.
 * @param {Object} req - Express request
 * @param {string} botToken - Токен бота
 * @returns {Object|null} - { userId } или null
 */
function validateBotSecret(req, botToken) {
  const botSecret = req.headers['x-bot-secret'];
  const userIdStr = req.headers['x-telegram-user-id'];

  if (!botSecret || !userIdStr || !botToken) return null;

  // Проверяем секрет: HMAC-SHA256 от токена бота с ключом 'BotServerAuth'
  const expectedSecret = crypto
    .createHmac('sha256', 'BotServerAuth')
    .update(botToken)
    .digest('hex');

  // Timing-safe сравнение
  try {
    const secretBuf = Buffer.from(botSecret, 'hex');
    const expectedBuf = Buffer.from(expectedSecret, 'hex');
    if (secretBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretBuf, expectedBuf)) {
      logger.warn('Неверный X-Bot-Secret');
      return null;
    }
  } catch (err) {
    logger.warn('Ошибка проверки X-Bot-Secret', { error: err.message });
    return null;
  }

  const userId = parseInt(userIdStr, 10);
  if (isNaN(userId) || userId < 1) {
    logger.warn('Неверный X-Telegram-User-Id');
    return null;
  }

  return { userId };
}

/**
 * Middleware для проверки авторизации Telegram
 * Поддерживает два режима:
 * 1. WebApp: X-Telegram-Init-Data (подпись от Telegram)
 * 2. Bot-to-API: X-Bot-Secret + X-Telegram-User-Id (серверный вызов)
 * @param {string} botToken - Токен бота для проверки
 * @returns {Function} Express middleware
 */
function createAuthMiddleware(botToken) {
  return (req, res, next) => {
      // Способ 1: WebApp initData (из header или query param для стриминга)
      const initData = req.headers['x-telegram-init-data'] || req.query.init_data;
    if (initData) {
      const validated = validateInitData(initData, botToken);
      if (validated) {
req.userId = validated.user.id;
        return next();
      }
    }

    // Способ 2: Bot-to-API серверный вызов
    const botAuth = validateBotSecret(req, botToken);
    if (botAuth) {
      req.userId = botAuth.userId;
      req.telegramUser = { id: botAuth.userId };
      return next();
    }

    return res.status(401).json({ error: 'Нет доступа — неверный initData или секрет' });
  };
}

module.exports = { validateInitData, validateBotSecret, createAuthMiddleware, MAX_AUTH_AGE_SECONDS };
