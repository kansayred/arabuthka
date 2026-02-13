/**
 * Централизованная система логирования для Arabuthka Telegram Bot
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
 * Форматирует сообщение лога
 * @param {string} level - Уровень сообщения
 * @param {string} message - Текст сообщения
 * @param {Object} [meta] - Дополнительные данные
 * @returns {string}
 */
function formatMessage(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const upperLevel = level.toUpperCase().padEnd(5);

  // В production выводим JSON для удобного парсинга
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      service: 'telegram',
      message,
      ...(meta && { meta })
    });
  }

  // В development - читаемый формат с цветами
  const color = COLORS[level];
  let output = `${color}[${timestamp}] [${upperLevel}] [TG]${COLORS.reset} ${message}`;
  if (meta) {
    output += ` ${JSON.stringify(meta)}`;
  }
  return output;
}

/**
 * Логгер - основной объект для вывода логов
 */
const logger = {
  debug(message, meta = null) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  info(message, meta = null) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },

  warn(message, meta = null) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error(message, meta = null) {
    if (shouldLog('error')) {
      const errorMeta = meta instanceof Error
        ? { name: meta.name, message: meta.message, stack: meta.stack }
        : meta;
      console.error(formatMessage('error', message, errorMeta));
    }
  },

  /**
   * Логирует действие пользователя Telegram
   * @param {number} userId - ID пользователя
   * @param {string} action - Действие
   * @param {Object} [details] - Детали
   */
  userAction(userId, action, details = null) {
    this.info(`User action: ${action}`, { userId, action, ...details });
  },

  /**
   * Логирует команду бота
   * @param {number} chatId - ID чата
   * @param {string} command - Команда
   * @param {string} [username] - Имя пользователя
   */
  botCommand(chatId, command, username = null) {
    this.info(`Bot command: ${command}`, { chatId, command, username });
  }
};

module.exports = logger;
