// Загружаем .env только для локальной разработки (не на Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
  require('dotenv').config();
}

// =============================================
// ЦЕНТРАЛИЗОВАННОЕ ЛОГИРОВАНИЕ
// =============================================
const logger = require('./utils/logger');

// =============================================
// ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// =============================================
const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', 'WEBAPP_URL'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`КРИТИЧЕСКАЯ ОШИБКА: Переменная ${key} не задана!`);
    process.exit(1);
  }
}
logger.info('Telegram-бот: все переменные окружения присутствуют');

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// =============================================
// ИМПОРТ ОБРАБОТЧИКОВ СКАЧИВАНИЯ МУЗЫКИ
// =============================================
// ВРЕМЕННО ОТКЛЮЧЕНО: скачивание до заключения контрактов с лейблами
// const { handleDownload, handleSearch, handleDownloadCallback } = require('./handlers/downloadHandler');
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
  bot = new TelegramBot(token, { webHook: false });
} else {
  bot = new TelegramBot(token, { polling: true });
}

// =============================================
// EXPRESS-СЕРВЕР ДЛЯ WEBHOOK
// =============================================
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: isProduction ? 'webhook' : 'polling' });
});

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

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'друг';

  logger.botCommand(chatId, '/start', msg.from.username);

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

bot.onText(/\/help/, (msg) => {
  logger.botCommand(msg.chat.id, '/help', msg.from.username);
  sendHelpMessage(msg.chat.id);
});

bot.onText(/\/player/, (msg) => {
  logger.botCommand(msg.chat.id, '/player', msg.from.username);
  bot.sendMessage(msg.chat.id, '🎧 Открой плеер:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎵 Открыть Arabuthka', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

bot.onText(/\/download(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/download', msg.from.username);
  bot.sendMessage(msg.chat.id, '⚠️ Скачивание музыки временно недоступно.\n\nФункция будет восстановлена после заключения контрактов с лейблами.\n🎵 Пока вы можете загружать собственные треки через плеер.');
});

bot.onText(/\/music(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/music', msg.from.username);
  bot.sendMessage(msg.chat.id, '⚠️ Скачивание музыки временно недоступно.\n🎵 Загружайте собственные треки через плеер.');
});

bot.onText(/\/search(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/search', msg.from.username);
  bot.sendMessage(msg.chat.id, '⚠️ Поиск музыки временно недоступен.\n🎵 Загружайте собственные треки через плеер.');
});

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
    logger.botCommand(chatId, 'callback:help', query.from.username);
    sendHelpMessage(chatId);
    bot.answerCallbackQuery(query.id);
  }

  if (query.data && query.data.startsWith('download_')) {
    logger.botCommand(chatId, `callback:${query.data}`, query.from.username);
    bot.answerCallbackQuery(query.id, {
      text: '⚠️ Скачивание временно недоступно',
      show_alert: true
    });
  }
});

// =============================================
// ЗАПУСК СЕРВЕРА И WEBHOOK
// =============================================
const server = app.listen(PORT, async () => {
  logger.info(`Telegram-бот запущен на порту ${PORT}`);
  logger.info(`Режим: ${isProduction ? 'webhook' : 'polling'}`);

  if (isProduction && process.env.WEBHOOK_URL) {
    const webhookUrl = `${process.env.WEBHOOK_URL}${webhookPath}`;
    try {
      await bot.setWebHook(webhookUrl);
      logger.info(`Webhook установлен: ${webhookUrl}`);
    } catch (err) {
      logger.error('Ошибка установки webhook', err);
    }
  }
});

// =============================================
// GRACEFUL SHUTDOWN
// =============================================
async function gracefulShutdown(signal) {
  logger.warn(`Получен ${signal}. Завершаем работу...`);

  try {
    if (isProduction) {
      await bot.deleteWebHook();
      logger.info('Webhook удалён');
    } else {
      bot.stopPolling();
      logger.info('Polling остановлен');
    }
  } catch (err) {
    logger.error('Ошибка при завершении', err);
  }

  server.close(() => {
    logger.info('Сервер завершил работу');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================
// ПЕРЕХВАТ НЕОБРАБОТАННЫХ ОШИБОК
// =============================================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('НЕОБРАБОТАННЫЙ ПРОМИС (Телеграм-бот)', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('НЕОБРАБОТАННОЕ ИСКЛЮЧЕНИЕ (Телеграм-бот)', error);
  gracefulShutdown('uncaughtException');
});
