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
| File Storage | Cloudinary |
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
[Telegram Bot]     [Web App (Vercel)]
    |                      |
    v                      v
[Express API Server (Railway)]
    |              |
    v              v
[PostgreSQL]  [Cloudinary]
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
- Cloudinary account
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

## Project Structure

```
arabuthka/
|-- bot/                  # Express API server
|   |-- server.js         # Main server file
|   |-- package.json
|-- telegram/             # Telegram bot
|   |-- index.js          # Bot logic
|   |-- package.json
|-- webapp/               # Frontend (Vercel)
|   |-- index.html        # Main page
|   |-- app.js            # Player logic
|   |-- mediaSession.js   # Lock screen controls
|   |-- service-worker.js # PWA offline support
|   |-- style.css         # Styles
|   |-- manifest.json     # PWA manifest
|-- docs/                 # Documentation
|-- .env.example          # Environment variables template
|-- README.md
```

## Roadmap

- [ ] Lock screen and notification controls (PWA mode)
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
- **Storage:** Cloudinary
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

---

*Built with care in Samara, Russia*
