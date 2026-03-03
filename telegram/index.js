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

// ВРЕМЕННО ОТКЛЮЧЕНО: скачивание до заключения контрактов с лейблами
// const { handleDownload, handleSearch, handleDownloadCallback } = require('./handlers/downloadHandler');
// const { handleSearchCommand, handleDownloadCommand } = require('./handlers/musicHandler');

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL;
const PORT = process.env.PORT || 3000;

// =============================================
// ОПРЕДЕЛЯЕМ РЕЖИМ РАБОТЫ
// На Railway — webhook, локально — polling.
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
// РЕГИСТРАЦИЯ КОМАНД И MENU BUTTON
// setChatMenuButton — кнопка «🎵 Плеер» рядом с полем ввода
// setMyCommands — меню команд при нажатии «/»
// =============================================
async function setupBotInterface() {
  try {
    // Menu Button — кнопка WebApp рядом с полем ввода
    await bot.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🎵 Плеер',
        web_app: { url: webAppUrl }
      }
    });
    logger.info('Menu Button установлен: 🎵 Плеер');

    // Регистрация команд для меню «/»
    await bot.setMyCommands([
      { command: 'start', description: 'Запустить бота' },
      { command: 'player', description: 'Открыть плеер' },
      { command: 'about', description: 'О проекте Арабутка' },
      { command: 'help', description: 'Помощь и справка' }
    ]);
    logger.info('Команды бота зарегистрированы');
  } catch (err) {
    logger.error('Ошибка настройки интерфейса бота', err);
  }
}

// =============================================
// КОМАНДА /start — приветствие
// =============================================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'друг';

  logger.botCommand(chatId, '/start', msg.from.username);

  const welcomeMessage =
`Привет, ${firstName} 👋

Добро пожаловать в *Арабутку* — твой музыкальный мир внутри Telegram

Здесь ты можешь загружать любимые треки, собирать плейлисты и слушать музыку без рекламы и ограничений — всё в одном месте

Нажми *«🎵 Плеер»* рядом с полем ввода или кнопку ниже — и вперёд 🎧`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎧 Открыть плеер', web_app: { url: webAppUrl } }],
        [
          { text: '💡 О проекте', callback_data: 'about' },
          { text: '❓ Помощь', callback_data: 'help' }
        ]
      ]
    }
  });
});

// =============================================
// КОМАНДА /player — быстрый доступ к плееру
// =============================================
bot.onText(/\/player/, (msg) => {
  logger.botCommand(msg.chat.id, '/player', msg.from.username);
  bot.sendMessage(msg.chat.id, '🎧 Нажми, чтобы открыть плеер:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎵 Открыть Арабутку', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

// =============================================
// КОМАНДА /about — о проекте
// Написано понятным языком для всех, включая
// первых пользователей — маму и сестру.
// =============================================
bot.onText(/\/about/, (msg) => {
  logger.botCommand(msg.chat.id, '/about', msg.from.username);
  sendAboutMessage(msg.chat.id);
});

function sendAboutMessage(chatId) {
  const aboutText =
`🎵 *Что такое Арабутка?*

Арабутка — это музыкальный сервис хранения треков прямо в Telegram. Никаких отдельных приложений, всё работает здесь

*Зачем это нужно:*

Музыка объединяет людей. Мы создаём место, где каждый может свободно слушать, хранить и делиться любимыми треками — просто и без лишних сложностей

*Что уже работает:*

— загрузка своих треков в личную библиотеку
— прослушивание музыки прямо в Telegram
— плейлисты для удобной организации

*Что впереди:*

— умные рекомендации
— совместные плейлисты с друзьями
— подписка «Арамакс» с расширенными возможностями

Проект развивается каждый день. Если есть идеи, пожелания, претензии или что-то не работает — обязательно свяжись 💬

📩 Обратная связь: @napolar`;

  bot.sendMessage(chatId, aboutText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

// =============================================
// КОМАНДА /help — расширенная справка
// =============================================
bot.onText(/\/help/, (msg) => {
  logger.botCommand(msg.chat.id, '/help', msg.from.username);
  sendHelpMessage(msg.chat.id);
});

function sendHelpMessage(chatId) {
  const helpText =
`📖 *Справка по Арабутке*

*Команды:*

/start — приветствие и главное меню
/player — открыть музыкальный плеер
/about — узнать о проекте
/help — эта справка

*Как слушать музыку:*

1. Нажми *«🎵 Плеер»* — кнопка рядом с полем ввода
2. Загрузи свои треки через плеер
3. Слушай, создавай плейлисты, наслаждайся!

*Кнопка «🎵 Плеер»* всегда под рукой — она находится слева от поля ввода сообщения.

💬 Есть вопросы? Пиши: @napolar`;

  bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

// =============================================
// ЗАГЛУШКИ ДЛЯ ОТКЛЮЧЁННЫХ КОМАНД
// =============================================
bot.onText(/\/download(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/download', msg.from.username);
  bot.sendMessage(msg.chat.id, '⚠️ Скачивание музыки временно недоступно.\n\nФункция будет восстановлена после заключения контрактов с лейблами.\n🎵 Пока ты можешь загружать собственные треки через плеер.');
});

bot.onText(/\/music(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/music', msg.from.username);
  bot.sendMessage(msg.chat.id, '⚠️ Скачивание музыки временно недоступно.\n🎵 Загружай собственные треки через плеер.');
});

bot.onText(/\/search(.*)/, (msg) => {
  logger.botCommand(msg.chat.id, '/search', msg.from.username);
  bot.sendMessage(msg.chat.id, '⚠️ Поиск музыки временно недоступен.\n🎵 Загружай собственные треки через плеер.');
});

// =============================================
// ОБРАБОТКА CALLBACK-КНОПОК
// =============================================
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'help') {
    logger.botCommand(chatId, 'callback:help', query.from.username);
    sendHelpMessage(chatId);
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === 'about') {
    logger.botCommand(chatId, 'callback:about', query.from.username);
    sendAboutMessage(chatId);
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (data && data.startsWith('download_')) {
    logger.botCommand(chatId, `callback:${data}`, query.from.username);
    bot.answerCallbackQuery(query.id, {
      text: '⚠️ Скачивание временно недоступно',
      show_alert: true
    });
    return;
  }
});

// =============================================
// ЗАПУСК СЕРВЕРА, WEBHOOK И НАСТРОЙКА ИНТЕРФЕЙСА
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

  // Настройка Menu Button и регистрация команд
  await setupBotInterface();
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
