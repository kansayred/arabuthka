// =============================================
// PERFORMANCE MIDDLEWARE
// Middleware для мониторинга производительности API
// =============================================

const analytics = require('../analytics');

// ---------------------------------------------
// Статистика производительности в памяти
// ---------------------------------------------

// Метрики за последние 60 секунд
const performanceStats = {
  requests: [],
  slowQueries: [],
  errors: []
};

// Очистка старых метрик (оставляем только за 60 секунд)
setInterval(() => {
  const cutoff = Date.now() - 60000;
  performanceStats.requests = performanceStats.requests.filter(r => r.timestamp > cutoff);
  performanceStats.slowQueries = performanceStats.slowQueries.filter(q => q.timestamp > cutoff);
  performanceStats.errors = performanceStats.errors.filter(e => e.timestamp > cutoff);
}, 10000); // Каждые 10 секунд

// ---------------------------------------------
// Middleware для измерения времени ответа
// ---------------------------------------------

function performanceMiddleware(req, res, next) {
  const start = Date.now();
  const path = req.path;
  const method = req.method;

  // Перехватываем окончание запроса
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Сохраняем метрику
    const metric = {
      timestamp: Date.now(),
      method,
      path,
      duration,
      statusCode
    };

    performanceStats.requests.push(metric);

    // Отмечаем медленные запросы (>2с)
    if (duration > 2000) {
      performanceStats.slowQueries.push({
        ...metric,
        warning: 'Slow response'
      });

      console.warn(`⚠️  Медленный запрос: ${method} ${path} - ${duration}ms`);
      
      // Трекинг в аналитику
      analytics.trackEvent('system', 'slow_request', {
        method,
        path,
        duration
      });
    }

    // Отмечаем ошибки (5xx)
    if (statusCode >= 500) {
      performanceStats.errors.push({
        ...metric,
        type: 'server_error'
      });
    }
  });

  next();
}

// ---------------------------------------------
// Эндпоинт для получения метрик
// ---------------------------------------------

function getPerformanceStats() {
  const now = Date.now();
  const cutoff = now - 60000; // Последняя минута

  // Фильтруем только свежие данные
  const recentRequests = performanceStats.requests.filter(r => r.timestamp > cutoff);
  
  // Вычисляем статистику
  const totalRequests = recentRequests.length;
  const avgResponseTime = totalRequests > 0
    ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / totalRequests
    : 0;

  const requestsPerMinute = totalRequests;
  const slowRequestsCount = performanceStats.slowQueries.filter(q => q.timestamp > cutoff).length;
  const errorRate = totalRequests > 0
    ? (performanceStats.errors.filter(e => e.timestamp > cutoff).length / totalRequests) * 100
    : 0;

  // Группировка по эндпоинтам
  const endpointStats = {};
  recentRequests.forEach(r => {
    const key = `${r.method} ${r.path}`;
    if (!endpointStats[key]) {
      endpointStats[key] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0
      };
    }
    endpointStats[key].count++;
    endpointStats[key].totalDuration += r.duration;
  });

  // Вычисляем среднее время для каждого эндпоинта
  Object.keys(endpointStats).forEach(key => {
    endpointStats[key].avgDuration = Math.round(
      endpointStats[key].totalDuration / endpointStats[key].count
    );
    delete endpointStats[key].totalDuration;
  });

  return {
    summary: {
      totalRequests,
      requestsPerMinute,
      avgResponseTime: Math.round(avgResponseTime),
      slowRequestsCount,
      errorRate: errorRate.toFixed(2) + '%'
    },
    endpoints: endpointStats,
    slowQueries: performanceStats.slowQueries.slice(-10), // Последние 10
    recentErrors: performanceStats.errors.slice(-10) // Последние 10
  };
}

// ---------------------------------------------
// Экспорт
// ---------------------------------------------

module.exports = {
  performanceMiddleware,
  getPerformanceStats
};
