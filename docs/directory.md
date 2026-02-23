# 📂 Структура проекта Arabuthka

Этот документ описывает организацию файлов и папок в проекте Arabuthka. Проект состоит из трёх основных компонентов: **bot** (Telegram-бот), **telegram** (API-сервер), **webapp** (веб-приложение).

---

## 🗂️ Общая структура

```
arabuthka/
├── bot/                  # Telegram-бот для загрузки треков
├── telegram/            # API-сервер (Railway)
├── webapp/              # Веб-приложение (Next.js + Vercel)
├── docs/                # Документация
├── .gitignore
└── README.md
```

---

## 🤖 `bot/` - Telegram-бот

Компонент для загрузки и управления музыкальными файлами через Telegram.

### Структура:

```
bot/
├── node_modules/        # Зависимости npm
├── package-lock.json    # Фиксация версий зависимостей
├── package.json         # Конфигурация проекта и зависимости
├── server.js            # Основной файл бота
└── .env                 # Переменные окружения (не в Git)
```

### Описание файлов:

#### `server.js`
- **Назначение**: Главный файл бота
- **Функционал**:
  - Инициализация Grammy (библиотека для Telegram Bot API)
  - Обработка входящих сообщений
  - Загрузка MP3-файлов от пользователей
  - Отправка файлов в Selectel S3
  - Сохранение метаданных в базу через API
- **Технологии**: Node.js, Grammy, Axios, FormData

#### `package.json`
- **Зависимости**:
  - `grammy` - Библиотека для Telegram Bot API
  - `axios` - HTTP-клиент
  - `form-data` - Работа с multipart/form-data
  - `dotenv` - Загрузка переменных окружения
- **Скрипты**:
  - `start`: Запуск бота (`node server.js`)

#### `.env`
Конфиденциальные переменные (не коммитятся в Git):
```env
BOT_TOKEN=your_telegram_bot_token
RAILWAY_API_URL=https://arabuthka-production.up.railway.app
Selectel S3_URL=Selectel S3://...
Selectel S3_CLOUD_NAME=your_cloud_name
Selectel S3_API_KEY=your_api_key
Selectel S3_API_SECRET=your_api_secret
```
