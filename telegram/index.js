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
// ЗАПУСК СЕРВЕРА И НАСТРОЙКА WEBHOOK
// =============================================
app.listen(PORT, async () => {
  console.log(`🚀 Сервер бота запущен на порту ${PORT}`);

  if (isProduction) {
    // На продакшне устанавливаем webhook — Telegram будет
    // отправлять обновления на наш HTTPS-адрес.
    // WEBHOOK_URL должен быть вида https://your-service.up.railway.app
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await bot.setWebHook(`${webhookUrl}${webhookPath}`);
        console.log(`✅ Webhook установлен: ${webhookUrl}${webhookPath}`);
      } catch (err) {
        console.error('❌ Не удалось установить webhook:', err.message);
      }
    } else {
      console.warn('⚠️ WEBHOOK_URL не задан — webhook не установлен');
    }
  } else {
    console.log('📡 Режим polling (локальная разработка)');
  }
});

// =============================================
// ОБРАБОТКА ОШИБОК
// =============================================
// Ошибки polling (только в локальном режиме)
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error.message);
});

// Ошибки webhook (продакшн)
bot.on('webhook_error', (error) => {
  console.error('❌ Ошибка webhook:', error.message);
});

// =============================================
// GRACEFUL SHUTDOWN
// =============================================
// При завершении процесса корректно останавливаем бота
// и убираем webhook, чтобы Telegram не слал запросы в пустоту.
const shutdown = async () => {
  console.log('\n🛑 Получен сигнал завершения, останавливаем бот...');
  try {
    if (isProduction) {
      await bot.deleteWebHook();
      console.log('✅ Webhook удалён');
    } else {
      await bot.stopPolling();
      console.log('✅ Polling остановлен');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка при остановке:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
