// Загружаем .env только для локальной разработки (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

// =============================================
// ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// =============================================
const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', 'WEBAPP_URL'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Переменная ${key} не задана!`);
    process.exit(1);
  }
}

console.log('✅ Telegram-бот: все переменные окружения присутствуют');

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// =============================================
// ИМПОРТ ОБРАБОТЧИКОВ СКАЧИВАНИЯ МУЗЫКИ
// =============================================
const { handleDownload, handleSearch, handleDownloadCallback } = require('./handlers/downloadHandler');
// const { handleSearchCommand, handleDownloadCommand } = require('./handlers/musicHandler');

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL;
const PORT = process.env.PORT || 3000;

// =============================================
// ОПРЕДЕЛЯЕМ РЕЖИМ РАБОТЫ
// На Railway — webhook, локально — polling.
// Webhook экономит ресурсы: бот не опрашивает Telegram,
// а получает обновления push-уведомлениями.
// =============================================
const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

let bot;
if (isProduction) {
  // Продакшн: webhook-режим — бот не запускает polling,
  // а ждёт POST-запросы от Telegram на наш сервер
  bot = new TelegramBot(token, { webHook: false });
} else {
  // Локально: polling — удобнее для разработки,
  // не нужен публичный URL
  bot = new TelegramBot(token, { polling: true });
}

// =============================================
// EXPRESS-СЕРВЕР ДЛЯ WEBHOOK
// =============================================
const app = express();

// Telegram отправляет обновления в формате JSON
app.use(express.json());

// Health-check — Railway проверяет, жив ли сервис
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: isProduction ? 'webhook' : 'polling' });
});

// Эндпоинт для Telegram webhook — сюда приходят все обновления.
// Секретный путь на основе токена защищает от подделки запросов.
const webhookPath = `/webhook/${token}`;
app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Arabuthka Telegram Bot работает');
});

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

// /download - Скачивание музыки по запросу
// bot.onText(/\/download/, (msg) => handleDownloadCommand(msg));

           // /music - Альтернативная команда для скачивания музыки
// bot.onText(/\/music/, (msg) => handleDownloadCommand(msg));

// /search - Поиск музыки с результатами
// bot.onText(/\/search/, (msg) => handleSearchCommand(msg));


// =============================================
// ФУНКЦИЯ ПОМОЩИ
// =============================================
function sendHelpMessage(chatId) {
  const helpText = `📖 *Справка по Arabuthka*

*Команды:*
/start — начать работу
/player — открыть плеер
/help — эта справка

*Как пользоваться:*
1. Открой плеер через кнопку
2. Загрузи свои треки
3. Слушай музыку!`;

  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// =============================================
// ОБРАБОТКА CALLBACK-КНОПОК
// =============================================
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  
  if (query.data === 'help') {
    sendHelpMessage(chatId);
    bot.answerCallbackQuery(query.id);
  }
});

// =============================================
// ЗАПУСК СЕРВЕРА И WEBHOOK
// =============================================
const server = app.listen(PORT, async () => {
  console.log(`🚀 Telegram-бот запущен на порту ${PORT}`);
  console.log(`📍 Режим: ${isProduction ? 'webhook' : 'polling'}`);
  
  // В production-режиме устанавливаем webhook
  if (isProduction && process.env.WEBHOOK_URL) {
    const webhookUrl = `${process.env.WEBHOOK_URL}${webhookPath}`;
    try {
      await bot.setWebHook(webhookUrl);
      console.log(`✅ Webhook установлен: ${webhookUrl}`);
    } catch (err) {
      console.error('❌ Ошибка установки webhook:', err.message);
    }
  }
});

// =============================================
// GRACEFUL SHUTDOWN
// Корректное завершение при получении SIGTERM/SIGINT
// =============================================
async function gracefulShutdown(signal) {
  console.log(`\n⚠️ Получен ${signal}. Завершаем работу...`);
  
  try {
    // В production удаляем webhook
    if (isProduction) {
      await bot.deleteWebHook();
      console.log('🔗 Webhook удалён');
    } else {
      // В режиме polling останавливаем опрос
      bot.stopPolling();
      console.log('📴 Polling остановлен');
    }
  } catch (err) {
    console.error('❌ Ошибка при завершении:', err.message);
  }
  
  server.close(() => {
    console.log('✅ Сервер завершил работу');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
