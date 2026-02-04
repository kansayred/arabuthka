// Загружаем .env только для локальной разработки (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN; // ← Берём из .env
const bot = new TelegramBot(token, { polling: true });
const webAppUrl = process.env.WEBAPP_URL; // ← Тоже из .env

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🎵 Добро пожаловать в Арабутку!', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎧 Открыть плеер', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

console.log('Арабутка запущена...');
