/**
 * Handlers Index
 * Центральная точка экспорта всех обработчиков команд
 */

const musicHandler = require('./musicHandler');
const downloadHandler = require('./downloadHandler');

/**
 * Регистрация всех обработчиков для бота
 * @param {Object} bot - Экземпляр Telegram бота
 */
function registerHandlers(bot) {
  // Обработчики музыкального поиска
  bot.onText(/\/search (.+)/, (msg, match) => {
    musicHandler.handleSearch(bot, msg, match[1]);
  });

  // Обработчик скачивания
  bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    
    if (data.startsWith('download_')) {
      await downloadHandler.handleDownload(bot, callbackQuery);
    } else if (data.startsWith('page_')) {
      await musicHandler.handlePagination(bot, callbackQuery);
    }
  });

  // Обработчик аудио сообщений
  bot.on('audio', (msg) => {
    musicHandler.handleAudioMessage(bot, msg);
  });

  console.log('All handlers registered successfully');
}

module.exports = {
  registerHandlers,
  musicHandler,
  downloadHandler
};
