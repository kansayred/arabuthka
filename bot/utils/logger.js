/**
 * Централизованная система логирования для Arabuthka Bot
 * 
 * Поддерживает уровни: debug, info, warn, error
 * Настраивается через переменную окружения LOG_LEVEL
 */

// Уровни логирования и их приоритеты
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Цвета для консоли (для локальной разработки)
const COLORS = {
  debug: '\x1b[36m',  // Голубой
  info: '\x1b[32m',   // Зелёный
  warn: '\x1b[33m',   // Жёлтый
  error: '\x1b[31m',  // Красный
  reset: '\x1b[0m'    // Сброс
};

/**
 * Получает текущий уровень логирования из окружения
 * @returns {string} Текущий уровень логирования
 */
function getCurrentLevel() {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

/**
 * Проверяет, нужно ли выводить лог данного уровня
 * @param {string} level - Уровень сообщения
 * @returns {boolean}
 */
function shouldLog(level) {
  const currentLevel = getCurrentLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Форматирует время для лога
 * @returns {string} Время в формате ISO
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Форматирует сообщение лога
 * @param {string} level - Уровень сообщения
 * @param {string} message - Текст сообщения
 * @param {Object} [meta] - Дополнительные данные
 * @returns {string}
 */
function formatMessage(level, message, meta = null) {
  const timestamp = getTimestamp();
  const upperLevel = level.toUpperCase().padEnd(5);
  
  // В production выводим JSON для удобного парсинга
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(meta && { meta })
    });
  }
  
  // В development - читаемый формат с цветами
  const color = COLORS[level];
  let output = `${color}[${timestamp}] [${upperLevel}]${COLORS.reset} ${message}`;
  
  if (meta) {
    output += ` ${JSON.stringify(meta)}`;
  }
  
  return output;
}

/**
 * Логгер - основной объект для вывода логов
 */
const logger = {
  /**
   * Дебаг-сообщения (подробная отладка)
   * @param {string} message - Сообщение
   * @param {Object} [meta] - Доп. данные
   */
  debug(message, meta = null) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  /**
   * Информационные сообщения
   * @param {string} message - Сообщение
   * @param {Object} [meta] - Доп. данные
   */
  info(message, meta = null) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },

  /**
   * Предупреждения
   * @param {string} message - Сообщение
   * @param {Object} [meta] - Доп. данные
   */
  warn(message, meta = null) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  /**
   * Ошибки
   * @param {string} message - Сообщение
   * @param {Object|Error} [meta] - Доп. данные или объект ошибки
   */
  error(message, meta = null) {
    if (shouldLog('error')) {
      // Если meta - это Error, извлекаем полезную инфу
      const errorMeta = meta instanceof Error
        ? { name: meta.name, message: meta.message, stack: meta.stack }
        : meta;
      console.error(formatMessage('error', message, errorMeta));
    }
  },

  /**
   * Логирует HTTP запрос (для middleware)
   * @param {Object} req - Express request
   * @param {number} statusCode - Код ответа
   * @param {number} duration - Время обработки в ms
   */
  request(req, statusCode, duration) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`;
    
    this[level](message, {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
  },

  /**
   * Логирует действие пользователя Telegram
   * @param {number} userId - ID пользователя
   * @param {string} action - Действие
   * @param {Object} [details] - Детали
   */
  userAction(userId, action, details = null) {
    this.info(`User action: ${action}`, {
      userId,
      action,
      ...details
    });
  }
};

module.exports = logger;
