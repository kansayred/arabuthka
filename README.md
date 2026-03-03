# Arabuthka

**Arabuthka** (Arabutka) — music player and personal music library as a Telegram Mini App.

> Personal music space. Upload, listen, organize.

## About the Project

Arabuthka is an MVP of a music service integrated into Telegram. Users can upload their audio files, build a personal library, and listen to music directly within the Telegram interface.

The project is being prepared for its first round of investment.

## Tech Stack

| Component | Technology |
|---|---|
| Backend API | Node.js, Express |
| Database | PostgreSQL |
| File Storage | Selectel S3 |
| Telegram Bot | node-telegram-bot-api |
| Frontend | Vanilla JS, HTML, CSS (PWA) |
| Hosting (API) | Railway |
| Hosting (Frontend) | Vercel |
| Auth | Telegram InitData (HMAC-SHA256) |

## Architecture

```
Telegram App
    |
    v
[Telegram Bot]      [Web App (Vercel)]
    |                    |
    v                    v
[Express API Server (Railway)]
    |                    |
    v                    v
[PostgreSQL]        [Selectel S3]
```

**Three services:**
- `bot/` — Express API server (auth, upload, tracks CRUD)
- `telegram/` — Telegram bot (polling mode)
- `webapp/` — Frontend player with PWA support

## Features

- Upload audio files (MP3, WAV, OGG, M4A, AAC)
- Personal music library per user
- Playback with progress bar, volume control
- Shuffle and repeat modes
- Search and sort tracks
- Media Session API support (lock screen controls)
- Telegram-based authentication
- PWA with offline caching
- File validation and rate limiting

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Selectel S3 account
- Telegram Bot Token (via @BotFather)

### Environment Variables

See `.env.example` in the root directory for all required variables.

### Installation

```bash
# Clone the repository
git clone https://github.com/kansayred/arabuthka.git
cd arabuthka

# Install API server dependencies
cd bot
npm install

# Install Telegram bot dependencies
cd ../telegram
npm install
```

### Running Locally

```bash
# Start the API server
cd bot
node server.js

# Start the Telegram bot (in a separate terminal)
cd telegram
node index.js

# Frontend — serve the webapp/ folder or deploy to Vercel
```

### Deployment

#### Railway (Backend API)

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add PostgreSQL plugin
4. Set environment variables:
   - `DATABASE_URL` (auto-set by Railway PostgreSQL plugin)
   - `TELEGRAM_BOT_TOKEN`
   - `S3_BUCKET_NAME`
   - `S3_ACCESS_KEY`
   - `S3_SECRET_KEY`
5. Set root directory to `bot/`
6. Set start command: `node server.js`
7. Deploy

#### Vercel (Frontend)

1. Import the repository on [Vercel](https://vercel.com)
2. Set root directory to `webapp/`
3. Deploy as static site
4. Update `API_URL` in `webapp/app.js` to your Railway domain

#### Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set the Web App URL to your Vercel deployment
3. Configure webhook or use polling mode

## Project Structure

```
arabuthka/
|-- bot/                        # Express API server
|   |-- server.js               # Main server file
|   |-- middleware/              # Middleware modules
|   |   |-- auth.js             # Telegram InitData auth
|   |   |-- errorHandler.js     # Error handling
|   |   |-- rateLimit.js        # Rate limiting
|   |-- services/               # Business logic
|   |   |-- cobaltDownloader.js # Music download via Cobalt
|   |   |-- musicSearch.js      # iTunes/Deezer search
|   |   |-- libraryService.js   # User library management
|   |   |-- validators.js       # Data validation
|   |-- utils/                  # Utilities
|   |   |-- logger.js           # Logging system
|   |-- package.json
|-- db/                         # Database
|   |-- init.sql                # Schema initialization
|-- telegram/                   # Telegram bot
|   |-- index.js                # Bot entry point
|   |-- handlers/               # Command handlers
|   |   |-- musicHandler.js     # Music search & pagination
|   |   |-- downloadHandler.js  # Track download
|   |-- services/               # Bot services
|   |   |-- musicService.js     # Music search API
|   |   |-- libraryService.js   # Library management
|   |-- package.json
|-- webapp/                     # Frontend (Vercel)
|   |-- index.html              # Main page
|   |-- app.js                  # Player logic
|   |-- mediaSession.js         # Lock screen controls
|   |-- service-worker.js       # PWA offline support
|   |-- style.css               # Styles
|   |-- manifest.json           # PWA manifest
|-- docs/                       # Documentation
|-- .env.example                # Environment variables template
|-- CONTRIBUTING.md             # Contribution guide
|-- README.md
|-- vercel.json                 # Vercel config
```

## Roadmap

- [x] Lock screen and notification controls (PWA mode)
- [x] Telegram bot commands (/start, /about, /help, /search)
- [x] Menu Button (WebApp) — quick player access
- [x] Inline keyboard & callback handlers
- [ ] Track standardization system ("Lopasti i Zhernova" rules)
- [ ] Recommendation algorithm "Delamain"
- [ ] Multi-language support (EN, RU)
- [ ] Karaoke mode (synced lyrics)
- [ ] Collaborative playlists
- [ ] Track migration from other services
- [ ] Subscription system
- [ ] Integration with "Ribbit" fitness trainer
- [ ] Voice assistant
- [ ] Advanced UI/UX redesign

## Key Resources

- **Hosting:** Railway (backend), Vercel (frontend)
- **Storage:** Selectel S3
- **Code:** GitHub
- **IDE:** VSCode

## Security

- Telegram InitData HMAC-SHA256 validation
- File type and size validation (25 MB limit)
- CORS restricted to production domain
- Rate limiting on API endpoints
- User-scoped data (each user sees only their tracks)

## License

This project is proprietary. All rights reserved.

## Author

**Arabuthka Team**

## Backend Модули

### Middleware

| Модуль | Описание |
|--------|----------|
| `auth.js` | Авторизация Telegram через InitData |
| `errorHandler.js` | Централизованная обработка ошибок |
| `rateLimit.js` | Защита от спама и DDoS |

### Utils

| Модуль | Описание |
|--------|----------|
| `logger.js` | Система логирования с уровнями |

### Services

| Модуль | Описание |
|--------|----------|
| `cobaltDownloader.js` | Скачивание музыки через Cobalt API |
| `ytsr.js` | Поиск видео на YouTube |
| `musicSearch.js` | Поиск через iTunes и Deezer API |
| `youtubeDownloader.js` | Fallback для скачивания аудио |
| `libraryService.js` | Управление персональной библиотекой пользователя |
| `validators.js` | Валидация входящих данных |

## Telegram Bot Модули

### Handlers

| Модуль | Описание |
|--------|------------|
| `index.js` | Централизованная регистрация обработчиков |
| `musicHandler.js` | Обработка поиска и пагинации музыки |
| `downloadHandler.js` | Обработка скачивания треков |

### Services

| Модуль | Описание |
|--------|------------|
| `index.js` | Экспорт всех сервисов |
| `musicService.js` | API для поиска музыки |
| `libraryService.js` | Управление библиотекой пользователя |

## См. также

- [CONTRIBUTING.md](CONTRIBUTING.md) — гайд по внесению изменений
- [bot/.env.example](bot/.env.example) — шаблон переменных окружения

---

*Built with care in Samara, Russia*
