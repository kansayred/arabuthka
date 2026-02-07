// =============================================
// ЕДИНЫЙ ПУЛ ПОДКЛЮЧЕНИЙ К POSTGRESQL
// Один пул на всё приложение — экономим соединения.
// Railway имеет ограничение на количество коннектов,
// поэтому критически важно не плодить пулы.
// =============================================

const { Pool } = require('pg');

// Создаём пул один раз при первом require()
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Ограничиваем кол-во соединений — Railway даёт не так много
  max: 10,
  // Таймаут ожидания свободного соединения (5 сек)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Логируем ошибки пула, чтобы не пропустить проблемы
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка пула PostgreSQL:', err.message);
});

module.exports = pool;
