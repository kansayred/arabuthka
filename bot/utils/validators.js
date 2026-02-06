/**
 * Утилиты валидации данных для Arabuthka Bot
 * 
 * Проверка входящих данных и санитизация
 */

const { ApiError } = require('../middleware/errorHandler');

/**
 * Проверяет, что значение существует и не пустое
 * @param {*} value - Значение для проверки
 * @param {string} fieldName - Название поля для сообщения
 * @throws {ApiError} Если значение не указано
 */
function required(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw ApiError.badRequest(`Поле "${fieldName}" обязательно`);
  }
  return value;
}

/**
 * Проверяет, что значение - строка с мин/макс длиной
 * @param {string} value - Строка для проверки
 * @param {string} fieldName - Название поля
 * @param {Object} options - Опции
 * @param {number} [options.min] - Минимальная длина
 * @param {number} [options.max] - Максимальная длина
 */
function stringLength(value, fieldName, { min = 0, max = Infinity } = {}) {
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть строкой`);
  }
  
  if (value.length < min) {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть не менее ${min} символов`);
  }
  
  if (value.length > max) {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть не более ${max} символов`);
  }
  
  return value;
}

/**
 * Проверяет число в диапазоне
 * @param {number} value - Число для проверки
 * @param {string} fieldName - Название поля
 * @param {Object} options - Опции
 * @param {number} [options.min] - Минимум
 * @param {number} [options.max] - Максимум
 */
function numberRange(value, fieldName, { min = -Infinity, max = Infinity } = {}) {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть числом`);
  }
  
  if (num < min || num > max) {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть от ${min} до ${max}`);
  }
  
  return num;
}

/**
 * Проверяет Telegram User ID
 * @param {number|string} userId - ID пользователя
 */
function telegramUserId(userId) {
  const id = Number(userId);
  
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Некорректный Telegram User ID');
  }
  
  return id;
}

/**
 * Санитизирует строку для безопасного использования
 * @param {string} str - Строка для очистки
 * @returns {string} Очищенная строка
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .trim()
    .replace(/[<>]/g, '') // Убираем HTML теги
    .substring(0, 5000); // Ограничиваем длину
}

/**
 * Проверяет значение из списка допустимых
 * @param {*} value - Значение для проверки
 * @param {string} fieldName - Название поля
 * @param {Array} allowedValues - Список допустимых значений
 */
function oneOf(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw ApiError.badRequest(
      `Поле "${fieldName}" должно быть одним из: ${allowedValues.join(', ')}`
    );
  }
  return value;
}

/**
 * Проверяет массив
 * @param {Array} value - Массив для проверки
 * @param {string} fieldName - Название поля
 * @param {Object} options - Опции
 * @param {number} [options.minLength] - Мин элементов
 * @param {number} [options.maxLength] - Макс элементов
 */
function isArray(value, fieldName, { minLength = 0, maxLength = Infinity } = {}) {
  if (!Array.isArray(value)) {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть массивом`);
  }
  
  if (value.length < minLength) {
    throw ApiError.badRequest(`Массив "${fieldName}" должен содержать минимум ${minLength} элементов`);
  }
  
  if (value.length > maxLength) {
    throw ApiError.badRequest(`Массив "${fieldName}" должен содержать максимум ${maxLength} элементов`);
  }
  
  return value;
}

/**
 * Проверяет boolean значение
 * @param {*} value - Значение для проверки
 * @param {string} fieldName - Название поля
 */
function isBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw ApiError.badRequest(`Поле "${fieldName}" должно быть true или false`);
  }
  return value;
}

module.exports = {
  required,
  stringLength,
  numberRange,
  telegramUserId,
  sanitizeString,
  oneOf,
  isArray,
  isBoolean
};
