// Загружаем .env только для локальной разработки (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const webAppUrl = process.env.WEBAPP_URL;

// =============================================
// КОМАНДЫ БОТА
// =============================================

// /start - Приветствие и открытие плеера
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'друг';
  
  const welcomeMessage = `🎵 *Добро пожаловать в Arabuthka, ${firstName}!*

Это твоя личная музыкальная библиотека в Telegram.

📱 *Что умеет бот:*
• Загружай свои треки
• Слушай музыку прямо в Telegram
• Управляй плейлистом

Нажми кнопку ниже, чтобы открыть плеер 👇`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎧 Открыть плеер', web_app: { url: webAppUrl } }],
        [{ text: '❓ Помощь', callback_data: 'help' }]
      ]
    }
  });
});

// /help - Справка по боту
bot.onText(/\/help/, (msg) => {
  sendHelpMessage(msg.chat.id);
});

// /player - Быстрое открытие плеера
bot.onText(/\/player/, (msg) => {
  bot.sendMessage(msg.chat.id, '🎧 Открой плеер:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎵 Открыть Arabuthka', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

// =============================================
// ОБРАБОТКА CALLBACK ЗАПРОСОВ
// =============================================

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  
  switch (query.data) {
    case 'help':
      sendHelpMessage(chatId);
      break;
    case 'open_player':
      bot.sendMessage(chatId, '🎧 Открой плеер:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎵 Открыть Arabuthka', web_app: { url: webAppUrl } }]
          ]
        }
      });
      break;
  }
  
  bot.answerCallbackQuery(query.id);
});

// =============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================

function sendHelpMessage(chatId) {
  const helpMessage = `📖 *Справка по Arabuthka*

*Команды:*
/start - Начать работу с ботом
/help - Показать эту справку
/player - Открыть плеер

*Как пользоваться:*
1️⃣ Открой плеер кнопкой ниже
2️⃣ Загрузи свои аудиофайлы
3️⃣ Наслаждайся музыкой!

*Поддерживаемые форматы:*
MP3, WAV, OGG, M4A

*Вопросы?*
Пиши разработчику: @kansayred`;

  bot.sendMessage(chatId, helpMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎧 Открыть плеер', web_app: { url: webAppUrl } }],
        [{ text: '🔙 В начало', callback_data: 'open_player' }]
      ]
    }
  });
}

// =============================================
// ЗАПУСК БОТА
// =============================================

console.log('🎵 Arabuthka бот запущен...');

// =============================================
// ОБРАБОТКА ОШИБОК POLLING
// =============================================
// Если polling обрывается (сеть/Telegram API недоступен),
// логируем ошибку, но не роняем процесс.
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error.message);
  // Можно добавить логику переподключения или уведомление
});

// =============================================
// GRACEFUL SHUTDOWN
// =============================================
// При завершении процесса (SIGTERM/SIGINT) корректно останавливаем polling,
// чтобы избежать "двойных" инстансов бота при рестарте.
const shutdown = async () => {
  console.log('\n🛑 Получен сигнал завершения, останавливаем бот...');
  try {
    await bot.stopPolling();
    console.log('✅ Polling остановлен корректно');
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка при остановке polling:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
