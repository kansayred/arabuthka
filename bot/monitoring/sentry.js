/**
 * Sentry Integration for Error Monitoring
 * Отслеживание ошибок и производительности
 */

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

// Инициализация Sentry
function init(app) {  if (!process.env.SENTRY_DSN) {
    console.log('⚠️  Sentry DSN не настроен. Мониторинг отключен.');
    return null;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT || 'development',
    
    // Performance Monitoring
    tracesSampleRate: process.env.RAILWAY_ENVIRONMENT ? 0.1 : 1.0,
    
    // Profiling
    profilesSampleRate: process.env.RAILWAY_ENVIRONMENT ? 0.1 : 1.0,
    
    integrations: [
      // HTTP трейсинг
      new Sentry.Integrations.Http({ tracing: true }),
      
      // Express интеграция
      new Sentry.Integrations.Express({ app: true }),
      
      // Profiling
      new ProfilingIntegration(),
    ],
    
    // Настройки трейсинга
    beforeSend(event, hint) {
      // Фильтруем чувствительные данные
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers['x-telegram-init-data'];
      }
      return event;
    },
    
    // Игнорируем определенные ошибки
    ignoreErrors: [
      'CORS заблокирован',
      'Нет доступа — неверный initData',
    ],
  });

  console.log('✅ Sentry инициализирован');
                    
  // Интеграция middleware с Express (если передан app)
  if (app) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }
  return Sentry;
}

// Middleware для Express
function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Отправляем в Sentry все ошибки со статусом >= 500
      return error.status >= 500;
    },
  });
}

// Функция для захвата исключений
function captureException(error, context = {}) {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.captureException(error, {
    extra: context,
  });
}

// Функция для кастомных событий
function captureMessage(message, level = 'info', context = {}) {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// Установка пользовательского контекста
function setUserContext(userId, username) {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.setUser({
    id: userId,
    username,
  });
}

// Добавление breadcrumb (следы действий пользователя)
function addBreadcrumb(category, message, data = {}) {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

module.exports = {
  init,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  captureException,
  captureMessage,
  setUserContext,
  addBreadcrumb,
};
