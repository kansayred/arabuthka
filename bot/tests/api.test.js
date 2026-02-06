/**
 * API Integration Tests
 * Тесты для проверки работы Backend API
 * 
 * Запуск: npm test
 */

const request = require('supertest');
const crypto = require('crypto');

// Функция для генерации валидного Telegram initData для тестов
function generateTestInitData(userId = 123456789, username = 'testuser') {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const authDate = Math.floor(Date.now() / 1000);
  
  const user = JSON.stringify({ id: userId, username, first_name: 'Test' });
  
  // Формируем параметры
  const params = new URLSearchParams({
    auth_date: authDate.toString(),
    user: user
  });
  
  // Вычисляем hash
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
    
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
    
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(sortedParams)
    .digest('hex');
    
  params.set('hash', hash);
  return params.toString();
}

// URL сервера для тестов
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

describe('API Health Check', () => {
  test('GET /health should return 200 OK', async () => {
    const response = await request(BASE_URL).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });
});

describe('Authentication', () => {
  test('Protected endpoint without auth should return 401', async () => {
    const response = await request(BASE_URL).get('/tracks');
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });
  
  test('Protected endpoint with invalid initData should return 401', async () => {
    const response = await request(BASE_URL)
      .get('/tracks')
      .set('X-Telegram-Init-Data', 'invalid_data');
    
    expect(response.status).toBe(401);
  });
  
  test('Protected endpoint with valid initData should succeed', async () => {
    const initData = generateTestInitData();
    
    const response = await request(BASE_URL)
      .get('/tracks')
      .set('X-Telegram-Init-Data', initData);
    
    // Должен вернуть 200 или 503 (если БД недоступна)
    expect([200, 503]).toContain(response.status);
  });
});

describe('GET /tracks', () => {
  const initData = generateTestInitData();
  
  test('Should return tracks with pagination', async () => {
    const response = await request(BASE_URL)
      .get('/tracks')
      .set('X-Telegram-Init-Data', initData);
    
    if (response.status === 200) {
      expect(response.body).toHaveProperty('tracks');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.tracks)).toBe(true);
      
      const { pagination } = response.body;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('hasNext');
      expect(pagination).toHaveProperty('hasPrev');
    }
  });
  
  test('Should respect page parameter', async () => {
    const response = await request(BASE_URL)
      .get('/tracks?page=2')
      .set('X-Telegram-Init-Data', initData);
    
    if (response.status === 200) {
      expect(response.body.pagination.page).toBe(2);
    }
  });
  
  test('Should respect limit parameter', async () => {
    const response = await request(BASE_URL)
      .get('/tracks?limit=10')
      .set('X-Telegram-Init-Data', initData);
    
    if (response.status === 200) {
      expect(response.body.pagination.limit).toBe(10);
    }
  });
  
  test('Should reject invalid pagination params', async () => {
    const response = await request(BASE_URL)
      .get('/tracks?page=0&limit=200')
      .set('X-Telegram-Init-Data', initData);
    
    expect(response.status).toBe(400);
  });
});

describe('POST /upload', () => {
  const initData = generateTestInitData();
  
  test('Should reject upload without file', async () => {
    const response = await request(BASE_URL)
      .post('/upload')
      .set('X-Telegram-Init-Data', initData);
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
  
  test('Should reject unsupported file format', async () => {
    const response = await request(BASE_URL)
      .post('/upload')
      .set('X-Telegram-Init-Data', initData)
      .attach('track', Buffer.from('test'), {
        filename: 'test.txt',
        contentType: 'text/plain'
      });
    
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe('DELETE /tracks/:id', () => {
  const initData = generateTestInitData();
  
  test('Should return 404 for non-existent track', async () => {
    const response = await request(BASE_URL)
      .delete('/tracks/999999')
      .set('X-Telegram-Init-Data', initData);
    
    expect(response.status).toBe(404);
  });
});

describe('Rate Limiting', () => {
  test('Should apply rate limits on excessive requests', async () => {
    const initData = generateTestInitData();
    const requests = [];
    
    // Отправляем 110 запросов (лимит - 100 за 15 минут)
    for (let i = 0; i < 110; i++) {
      requests.push(
        request(BASE_URL)
          .get('/health')
          .set('X-Telegram-Init-Data', initData)
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    // Должен сработать rate limiter
    expect(rateLimited).toBe(true);
  }, 30000); // Увеличиваем таймаут до 30 секунд
});

describe('CORS Headers', () => {
  test('Should include CORS headers in production', async () => {
    const response = await request(BASE_URL)
      .options('/health')
      .set('Origin', 'https://arabutka-webapp.vercel.app');
    
    if (process.env.RAILWAY_ENVIRONMENT) {
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    }
  });
});

describe('Security Headers', () => {
  test('Should include security headers', async () => {
    const response = await request(BASE_URL).get('/health');
    
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Error Handling', () => {
  test('Should return 404 for unknown routes', async () => {
    const response = await request(BASE_URL).get('/unknown-route');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('path', '/unknown-route');
  });
});
