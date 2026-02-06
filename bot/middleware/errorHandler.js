/**
 * Централизованный обработчик ошибок для Express
 * 
 * Перехватывает все ошибки и отправляет унифицированный ответ
 */

const logger = require('../utils/logger');

/**
 * Класс для создания API ошибок с кодом статуса
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP код статуса
   * @param {string} message - Сообщение об ошибке
   * @param {string} [code] - Код ошибки для клиента
   */
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }

  // Частые ошибки
  static badRequest(message = 'Некорректный запрос') {
    return new ApiError(400, message, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Неавторизован') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Доступ запрещён') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Ресурс не найден') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static tooManyRequests(message = 'Слишком много запросов') {
    return new ApiError(429, message, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'Внутренняя ошибка сервера') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}

/**
 * Middleware для обработки 404 ошибок
 * Используй перед errorHandler
 */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Маршрут ${req.method} ${req.originalUrl} не найден`));
}

/**
 * Главный middleware для обработки ошибок
 * Должен быть последним в цепочке middleware
 * 
 * @param {Error} err - Объект ошибки
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Следующий middleware
 */
function errorHandler(err, req, res, next) {
  // Определяем код статуса
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Неизвестная ошибка';
  let code = err.code || 'UNKNOWN_ERROR';

  // Обработка специфических ошибок
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Неверный токен';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Токен истёк';
  }

  // Логируем ошибку
  if (statusCode >= 500) {
    logger.error(`Ошибка сервера: ${message}`, err);
  } else {
    logger.warn(`Ошибка клиента: ${message}`, {
      statusCode,
      code,
      url: req.originalUrl,
      method: req.method
    });
  }

  // Формируем ответ
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  // В development добавляем stack trace
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  ApiError,
  notFoundHandler,
  errorHandler
};
