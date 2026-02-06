# Monitoring & Analytics Guide

> Руководство по мониторингу и аналитике Arabuthka (Фаза 1: Стабилизация)

## Обзор

Система мониторинга состоит из двух основных компонентов:
1. **Sentry** - отслеживание ошибок и производительности
2. **Analytics** - метрики использования и поведения пользователей

---

## 1. Sentry - Error Monitoring

### Настройка

1. Зарегистрируйтесь на [sentry.io](https://sentry.io)
2. Создайте новый проект (Platform: Node.js)
3. Скопируйте DSN
4. Добавьте в Railway environment variables:

```bash
SENTRY_DSN=https://xxxxx@o####.ingest.sentry.io/####
```

### Установка зависимостей

```bash
cd bot
npm install @sentry/node @sentry/profiling-node
```

### Интеграция в server.js

```javascript
const { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } = require('./monitoring/sentry');

// Инициализация Sentry (в начале файла, после dotenv)
initSentry();

// Middleware (ПЕРЕД всеми роутами)
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Error handler (ПОСЛЕ всех роутов)
app.use(sentryErrorHandler());
```

### Использование

```javascript
const { captureException, captureMessage, setUserContext, addBreadcrumb } = require('./monitoring/sentry');

// Захват ошибок
try {
  // код
} catch (error) {
  captureException(error, { context: 'upload' });
}

// Кастомные события
captureMessage('User uploaded large file', 'warning', { size: 50MB });

// Установка пользователя
setUserContext(userId, username);

// Breadcrumbs (следы действий)
addBreadcrumb('upload', 'File upload started', { filename: 'song.mp3' });
```

---

## 2. Analytics - Metrics Tracking

### Настройка

1. Добавьте в Railway:

```bash
ANALYTICS_ENABLED=true
```

2. Инициализация автоматически создаст таблицу `analytics_events`

### Интеграция в server.js

```javascript
const { initAnalyticsTable, Analytics } = require('./monitoring/analytics');

// После инициализации БД
await initAnalyticsTable(pool);
const analytics = new Analytics(pool);

// Сделать доступным глобально
app.locals.analytics = analytics;
```

### Отслеживание событий

```javascript
// В middleware аутентификации
req.analytics = app.locals.analytics;

// В роутах
app.post('/upload', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // ... логика загрузки
    
    await req.analytics.trackUpload(
      req.userId,
      req.file.size,
      req.file.mimetype,
      Date.now() - startTime
    );
  } catch (error) {
    await req.analytics.trackUploadError(
      req.userId,
      error,
      req.file?.size
    );
  }
});

app.get('/tracks', async (req, res) => {
  await req.analytics.trackUserLogin(req.userId);
  // ... остальная логика
});
```

---

## 3. Доступные метрики

### Ключевые метрики

```javascript
const analytics = app.locals.analytics;

// DAU (Daily Active Users)
const dau = await analytics.getDailyActiveUsers();

// MAU (Monthly Active Users)
const mau = await analytics.getMonthlyActiveUsers(2026, 2);

// Uploads за период
const uploads = await analytics.getUploadsCount(startDate, endDate);

// Топ пользователей
const topUsers = await analytics.getTopUsers(10, startDate, endDate);

// Статистика событий
const eventStats = await analytics.getEventStats(startDate, endDate);

// Retention rate
const retention = await analytics.getRetentionRate(7); // 7 дней

// Среднее количество треков
const avgTracks = await analytics.getAverageTracksPerUser();

// Все метрики сразу (Dashboard)
const dashboard = await analytics.getDashboardStats();
```

### Dashboard данные

```json
{
  "dau": 150,
  "mau": 1200,
  "uploads_30d": 450,
  "avg_tracks_per_user": "12.5",
  "retention_7d": "42.5",
  "dau_mau_ratio": "12.5"
}
```

---

## 4. Endpoint для метрик

Добавьте в server.js:

```javascript
// Endpoint для dashboard (только для админов)
app.get('/admin/metrics', async (req, res) => {
  try {
    const stats = await analytics.getDashboardStats();
    res.json(stats);
  } catch (error) {
    captureException(error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});
```

---

## 5. События для отслеживания

### Пользовательские события
- `user_registration` - регистрация нового пользователя
- `user_login` - вход пользователя

### События загрузки
- `track_upload` - успешная загрузка трека
- `upload_error` - ошибка загрузки

### События воспроизведения
- `track_play` - начало воспроизведения
- `track_pause` - пауза
- `track_complete` - трек прослушан до конца

### События удаления
- `track_delete` - удаление трека

---

## 6. Мониторинг в Production

### Sentry Dashboard

1. **Issues** - все ошибки с stack traces
2. **Performance** - производительность API endpoints
3. **Releases** - отслеживание деплоев
4. **Alerts** - настройка уведомлений

### Custom Dashboards

Создайте SQL запросы для Grafana/Metabase:

```sql
-- Активные пользователи по дням
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as active_users
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Топ событий
SELECT 
  event_type,
  COUNT(*) as count
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

---

## 7. Alerts & Notifications

### Sentry Alerts

1. Зайдите в Sentry → Alerts
2. Создайте правила:
   - Error rate > 1% за 5 минут → email/Telegram
   - Response time > 500ms → warning
   - New issue появился → notification

### Railway Notifications

1. Settings → Notifications
2. Добавьте webhook для Telegram/Discord
3. Уведомления о deployment failures

---

## 8. Best Practices

### Производительность
- ✅ Не блокируйте запросы на analytics tracking
- ✅ Используйте async/await для всех операций
- ✅ Добавьте индексы на часто используемые поля

### Приватность
- ✅ Не логируйте чувствительные данные (пароли, токены)
- ✅ Фильтруйте initData в Sentry
- ✅ Анонимизируйте user_id при необходимости

### Costs
- ✅ Sentry Free: 5K errors/month
- ✅ Analytics: хранится в вашей PostgreSQL
- ✅ Sample rate 10% в production для экономии

---

## 9. Troubleshooting

### Sentry не отправляет события

1. Проверьте SENTRY_DSN
2. Убедитесь что initSentry() вызывается первым
3. Проверьте network в DevTools

### Analytics не записываются

1. Проверьте ANALYTICS_ENABLED=true
2. Убедитесь что таблица создана
3. Проверьте права доступа к БД

### Высокая нагрузка на БД

1. Добавьте индексы
2. Используйте batch inserts
3. Архивируйте старые события (>90 дней)

---

## 10. Roadmap

### Ближайшие улучшения
- [ ] Redis для кэширования метрик
- [ ] Real-time dashboard с WebSockets
- [ ] Экспорт метрик в CSV
- [ ] A/B testing framework
- [ ] Funnel analysis

---

## Поддержка

При возникновении проблем:
1. Проверьте [Issues](https://github.com/kansayred/arabuthka/issues)
2. Изучите логи в Railway
3. Проверьте Sentry dashboard
4. Создайте новый Issue с описанием
