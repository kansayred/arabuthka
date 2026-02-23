# Deployment Guide

> Инструкция по развёртыванию Arabuthka в production

## Содержание

- [Архитектура](#архитектура)
- [Backend (Railway)](#backend-railway)
- [Frontend (Vercel)](#frontend-vercel)
- [База данных (PostgreSQL)](#база-данных-postgresql)
- [Selectel S3](#selectel-s3)
- [Telegram Bot](#telegram-bot)
- [CI/CD](#cicd)
- [Мониторинг](#мониторинг)

---

## Архитектура

```
┌─────────────┐
│  Telegram   │
│   Mini App  │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│   Vercel    │◄────►│   Railway    │
│  (Frontend) │      │   (Backend)  │
└─────────────┘      └───────┬──────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              ┌──────────┐      ┌──────────┐
              │PostgreSQL│      │Selectel S3│
              │ (Railway)│      │  (Cloud) │
              └──────────┘      └──────────┘
```

**Компоненты:**
- **Frontend**: React + Vite → Vercel
- **Backend**: Node.js + Express → Railway
- **Database**: PostgreSQL → Railway
- **Storage**: Audio files → Selectel S3
- **Bot**: Telegram Bot API

---

## Backend (Railway)

### 1. Создание проекта

1. Зарегистрируйтесь на [Railway](https://railway.app)
2. Создайте новый проект
3. Выберите "Deploy from GitHub repo"
4. Подключите репозиторий `kansayred/arabuthka`
5. Укажите директорию: `bot`

### 2. Настройка переменных окружения

В разделе **Variables** добавьте:

| Variable | Description | Example |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123456:ABC-DEF1234...` |
| `S3_BUCKET_NAME` | Selectel S3 bucket name | `your-bucket-name` |
| `S3_ACCESS_KEY` | Selectel S3 access key | `123456789012345` |
| `S3_SECRET_KEY` | Selectel S3 secret key | `abcdefgh...` |
| `RAILWAY_ENVIRONMENT` | Auto-set by Railway | `production` |
| `RAILWAY_PUBLIC_DOMAIN` | Auto-set by Railway | `your-app.up.railway.app` |
| `PORT` | Server port (optional) | `3000` |

### 3. Настройка сборки

**Start Command:**
```bash
node server.js
```

**Build Command (optional):**
```bash
npm install
```

### 4. Публичный домен

1. Railway автоматически создаст домен вида `*.up.railway.app`
2. Или подключите свой домен в разделе **Settings → Domains**

### 5. Health Check

Railway автоматически проверяет `/health` endpoint:

```bash
curl https://your-app.up.railway.app/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T09:00:00.000Z",
  "uptime": 3600
}
```

---

## Frontend (Vercel)

### 1. Создание проекта

1. Зарегистрируйтесь на [Vercel](https://vercel.com)
2. Импортируйте репозиторий из GitHub
3. Настройте проект:
   - **Framework Preset**: Vite
   - **Root Directory**: `webapp`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2. Настройка переменных окружения

В разделе **Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-app.up.railway.app` |
| `VITE_BOT_USERNAME` | `@your_bot_username` |

### 3. Домен

Vercel предоставляет:
- Production: `arabuthka-webapp.vercel.app`
- Preview: `arabuthka-webapp-[hash].vercel.app`

Для кастомного домена:
1. **Settings → Domains**
2. Добавьте домен и настройте DNS

### 4. Автоматический деплой

- **Production**: деплой при push в `main`
- **Preview**: деплой при создании Pull Request

---

## База данных (PostgreSQL)

### 1. Создание на Railway

1. В проекте Railway нажмите **New → Database → PostgreSQL**
2. Railway автоматически создаст БД и установит `DATABASE_URL`

### 2. Схема базы данных

Бэкенд автоматически создаёт таблицу при старте:

```sql
CREATE TABLE IF NOT EXISTS tracks (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  s3_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
```

### 3. Подключение локально

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
psql $DATABASE_URL
```

### 4. Бэкап

```bash
pg_dump $DATABASE_URL > backup.sql
```

### 5. Восстановление

```bash
psql $DATABASE_URL < backup.sql
```

---

## Selectel S3

### 1. Регистрация

1. Зарегистрируйтесь на [Selectel S3](https://selectel.ru)
2. Перейдите в **Dashboard**
3. Скопируйте:
   - Bucket Name
   - Access Key
   - Secret Key

### 2. Настройка хранилища

- Папка для файлов: `arabutka/{user_id}/`
- Тип ресурса: `video` (для аудио)
- Максимальный размер: 25 MB

### 3. Управление файлами

Через [Панель управления S3](https://my.selectel.ru/storage/s3):
- Просмотр загруженных файлов
- Удаление неиспользуемых
- Статистика использования

---

## Telegram Bot

### 1. Создание бота

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Сохраните токен: `123456:ABC-DEF1234...`

### 2. Настройка Mini App

```
/setmenubutton
@your_bot → Button text: "🎵 Открыть плеер"
Web App URL: https://arabuthka-webapp.vercel.app
```

### 3. Описание бота

```
/setdescription
Арабутка — твоя личная музыкальная библиотека в Telegram.
Загружай, слушай и управляй треками прямо в мессенджере.
```

### 4. Команды

```
/setcommands
start - Запустить приложение
help - Помощь
```

---

## CI/CD

### GitHub Actions

Автоматические проверки настроены в `.github/workflows/`:

#### **ci.yml** - Continuous Integration

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd bot && npm ci
      - run: cd bot && npm run lint
      - run: cd bot && npm test
  
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd webapp && npm ci
      - run: cd webapp && npm run lint
      - run: cd webapp && npm run build
```

### Автоматический деплой

- **Railway**: автоматически деплоит при push в `main`
- **Vercel**: автоматически деплоит при push в `main` и PR

---

## Мониторинг

### Railway Metrics

**Доступно в Dashboard:**
- CPU usage
- Memory usage
- Network traffic
- Deploy logs

### Логирование

Бэкенд логирует:
```
✅ GET /tracks 200 - 45ms
⚠️ POST /upload 413 - 120ms
❌ GET /unknown 404 - 5ms
```

### Алерты

Настройте уведомления в Railway:
1. **Settings → Notifications**
2. Добавьте webhook или email

### Health Monitoring

Используйте [UptimeRobot](https://uptimerobot.com) или [Pingdom](https://pingdom.com):

- URL: `https://your-app.up.railway.app/health`
- Интервал: каждые 5 минут
- Уведомления при downtime

---

## Troubleshooting

### Backend не запускается

1. Проверьте логи в Railway Dashboard
2. Убедитесь, что все переменные окружения установлены
3. Проверьте соединение с БД:

```bash
psql $DATABASE_URL -c "SELECT NOW();"
```

### Frontend не подключается к API

1. Проверьте `VITE_API_URL` в Vercel
2. Проверьте CORS в `bot/server.js`:
   - Vercel домен должен быть в `allowedOrigins`
3. Проверьте Network tab в DevTools

### База данных недоступна

1. Railway PostgreSQL может перезапускаться
2. Backend автоматически переподключится (см. `initDatabase()`)
3. Проверьте статус БД в Railway Dashboard

### Selectel S3 ошибки

1. Проверьте квоту (Free: 25 GB)
2. Убедитесь, что S3 credentials правильные
3. Проверьте формат файлов (MP3, WAV, OGG, M4A, AAC)

---

## Checklist перед запуском

- [ ] Railway проект создан и настроен
- [ ] PostgreSQL база данных подключена
- [ ] Все environment variables установлены
- [ ] Backend успешно деплоится
- [ ] Health check возвращает 200
- [ ] Vercel проект создан
- [ ] Frontend деплоится корректно
- [ ] Selectel S3 аккаунт настроен
- [ ] Telegram бот создан и настроен
- [ ] Mini App URL установлен в боте
- [ ] CI/CD workflows работают
- [ ] Мониторинг настроен

---

## Масштабирование

### Railway

- **Free tier**: 500 часов/месяц
- **Hobby**: $5/месяц
- **Pro**: от $20/месяц

### PostgreSQL

- Увеличьте размер БД при необходимости
- Настройте connection pooling
- Добавьте индексы для частых запросов

### Selectel S3

- **Free**: 25 GB storage, 25 GB bandwidth
- **Plus**: от $99/месяц для больших объемов

---

## Поддержка

При возникновении проблем:

1. Проверьте [Issues](https://github.com/kansayred/arabuthka/issues)
2. Изучите логи в Railway и Vercel
3. Проверьте документацию в `docs/`
4. Создайте новый Issue с описанием проблемы
