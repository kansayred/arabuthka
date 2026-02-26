// =============================================
// МОДУЛЬ АВТОРИЗАЦИИ TELEGRAM
// Проверка и валидация initData от Telegram WebApp
// =============================================

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

    if (calculatedHash !== hash) {
            logger.warn('Неверная подпись initData');
      return null;
    }

    // Извлекаем данные пользователя
    const userStr = params.get('user');
    if (userStr) {
      const user = JSON.parse(decodeURIComponent(userStr));
      return { user, authDate };
    }

    return null;
  } catch (err) {
          logger.error('Ошибка валидации initData', { error: err.message });
    return null;
  }
}

/**
 * Middleware для проверки авторизации Telegram
 * @param {string} botToken - Токен бота для проверки
 * @returns {Function} Express middleware
 */
function createAuthMiddleware(botToken) {
  return (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'] || req.query.initData;
    const validated = validateInitData(initData, botToken);

    if (!validated) {
      return res.status(401).json({ error: 'Нет доступа — неверный initData' });
    }

    req.telegramUser = validated.user;
    req.userId = validated.user.id;
    next();
  };
}

module.exports = {
  validateInitData,
  createAuthMiddleware,
  MAX_AUTH_AGE_SECONDS
};
