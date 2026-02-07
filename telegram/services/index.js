/**
 * Services Index
 * Центральная точка экспорта всех сервисов
 */

const musicService = require('./musicService');
const libraryService = require('./libraryService');

/**
 * Инициализация всех сервисов
 * @returns {Object} Объект с инициализированными сервисами
 */
function initServices() {
  console.log('Initializing services...');
  
  return {
    music: musicService,
    library: libraryService
  };
}

module.exports = {
  musicService,
  libraryService,
  initServices
};
