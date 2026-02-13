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

  logger.botCommand(chatId, '/start', msg.from.username);

  const welcomeMessage = `\u{1F3B5} *Добро пожаловать в Arabuthka, ${firstName}!*
Это твоя личная музыкальная библиотека в Telegram.

\u{1F4F1} *Что умеет бот:*
\u{2022} Загружай свои треки
\u{2022} Слушай музыку прямо в Telegram
\u{2022} Управляй плейлистом

Нажми кнопку ниже, чтобы открыть плеер \u{1F447}`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '\u{1F3A7} Открыть плеер', web_app: { url: webAppUrl } }],
        [{ text: '\u{2753} Помощь', callback_data: 'help' }]
      ]
    }
  });
});

// /help - Справка по боту
bot.onText(/\/help/, (msg) => {
  logger.botCommand(msg.chat.id, '/help', msg.from.username);
  sendHelpMessage(msg.chat.id);
});

// /player - Быстрое открытие плеера
bot.onText(/\/player/, (msg) => {
  logger.botCommand(msg.chat.id, '/player', msg.from.username);
  bot.sendMessage(msg.chat.id, '\u{1F3A7} Открой плеер:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '\u{1F3B5} Открыть Arabuthka', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

// /download - Скачивание временно отключено (до заключения контрактов с лейблами)
bot.onText(/\/download(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/download', msg.from.username);
  bot.sendMessage(msg.chat.id, '\u{26A0}\u{FE0F} Скачивание музыки временно недоступно.\n\nФункция будет восстановлена после заключения контрактов с лейблами.\n\u{1F3B5} Пока вы можете загружать собственные треки через плеер.');
});

// /music - Альтернативная команда (тоже временно отключена)
bot.onText(/\/music(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/music', msg.from.username);
  bot.sendMessage(msg.chat.id, '\u{26A0}\u{FE0F} Скачивание музыки временно недоступно.\n\u{1F3B5} Загружайте собственные треки через плеер.');
});

// /search - Поиск временно отключён
bot.onText(/\/search(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/search', msg.from.username);
  bot.sendMessage(msg.chat.id, '\u{26A0}\u{FE0F} Поиск музыки временно недоступен.\n\u{1F3B5} Загружайте собственные треки через плеер.');
});

// =============================================
// ФУНКЦИЯ ПОМОЩИ
// =============================================
function sendHelpMessage(chatId) {
  const helpText = `\u{1F4D6} *Справка по Arabuthka*

*Команды:*
/start \u{2014} начать работу
/player \u{2014} открыть плеер
/help \u{2014} эта справка

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

  // Обработка кнопок скачивания музыки (временно отключено)
  if (query.data && query.data.startsWith('download_')) {
    logger.botCommand(chatId, `callback:${query.data}`, query.from.username);
    bot.answerCallbackQuery(query.id, {
      text: '\u{26A0}\u{FE0F} Скачивание временно недоступно',
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

  // В production-режиме устанавливаем webhook
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
// Корректное завершение при получении SIGTERM/SIGINT
// =============================================
async function gracefulShutdown(signal) {
  logger.warn(`Получен ${signal}. Завершаем работу...`);

  try {
    // В production удаляем webhook
    if (isProduction) {
      await bot.deleteWebHook();
      logger.info('Webhook удалён');
    } else {
      // В режиме polling останавливаем опрос
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
// Логируем вместо молчаливого падения процесса на Railway.
// =============================================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('НЕОБРАБОТАННЫЙ ПРОМИС (Телеграм-бот)', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('НЕОБРАБОТАННОЕ ИСКЛЮЧЕНИЕ (Телеграм-бот)', error);
  gracefulShutdown('uncaughtException');
});
