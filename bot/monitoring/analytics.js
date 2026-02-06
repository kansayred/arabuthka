/**
 * Analytics & Metrics Tracking
 * Аналитика и метрики использования
 */

const { Pool } = require('pg');

// Инициализация analytics таблицы
async function initAnalyticsTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_id BIGINT,
        properties JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Индексы для быстрых запросов
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at)');
    
    console.log('✅ Analytics таблица готова');
  } catch (error) {
    console.error('❌ Ошибка инициализации analytics:', error.message);
  }
}

// Класс для работы с аналитикой
class Analytics {
  constructor(pool) {
    this.pool = pool;
    this.enabled = !!process.env.ANALYTICS_ENABLED;
  }

  // Отслеживание события
  async trackEvent(eventType, userId, properties = {}) {
    if (!this.enabled) return;

    try {
      await this.pool.query(
        'INSERT INTO analytics_events (event_type, user_id, properties) VALUES ($1, $2, $3)',
        [eventType, userId, JSON.stringify(properties)]
      );
    } catch (error) {
      console.error('❌ Ошибка отслеживания события:', error.message);
    }
  }

  // === События пользователя ===

  async trackUserRegistration(userId, username) {
    await this.trackEvent('user_registration', userId, { username });
  }

  async trackUserLogin(userId) {
    await this.trackEvent('user_login', userId);
  }

  // === События загрузки ===

  async trackUpload(userId, fileSize, fileType, duration) {
    await this.trackEvent('track_upload', userId, {
      fileSize,
      fileType,
      duration,
    });
  }

  async trackUploadError(userId, error, fileSize) {
    await this.trackEvent('upload_error', userId, {
      error: error.message,
      fileSize,
    });
  }

  // === События воспроизведения ===

  async trackTrackPlay(userId, trackId) {
    await this.trackEvent('track_play', userId, { trackId });
  }

  async trackTrackPause(userId, trackId, position) {
    await this.trackEvent('track_pause', userId, { trackId, position });
  }

  async trackTrackComplete(userId, trackId) {
    await this.trackEvent('track_complete', userId, { trackId });
  }

  // === События удаления ===

  async trackTrackDelete(userId, trackId) {
    await this.trackEvent('track_delete', userId, { trackId });
  }

  // === Метрики ===

  // DAU (Daily Active Users)
  async getDailyActiveUsers(date = new Date()) {
    const result = await this.pool.query(`
      SELECT COUNT(DISTINCT user_id) as dau
      FROM analytics_events
      WHERE DATE(created_at) = DATE($1)
    `, [date]);
    return parseInt(result.rows[0].dau);
  }

  // MAU (Monthly Active Users)
  async getMonthlyActiveUsers(year, month) {
    const result = await this.pool.query(`
      SELECT COUNT(DISTINCT user_id) as mau
      FROM analytics_events
      WHERE EXTRACT(YEAR FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
    `, [year, month]);
    return parseInt(result.rows[0].mau);
  }

  // Количество загрузок за период
  async getUploadsCount(startDate, endDate) {
    const result = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'track_upload'
        AND created_at BETWEEN $1 AND $2
    `, [startDate, endDate]);
    return parseInt(result.rows[0].count);
  }

  // Наиболее активные пользователи
  async getTopUsers(limit = 10, startDate, endDate) {
    const result = await this.pool.query(`
      SELECT 
        user_id,
        COUNT(*) as event_count,
        COUNT(DISTINCT event_type) as unique_events
      FROM analytics_events
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY user_id
      ORDER BY event_count DESC
      LIMIT $3
    `, [startDate, endDate, limit]);
    return result.rows;
  }

  // Наиболее популярные события
  async getEventStats(startDate, endDate) {
    const result = await this.pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM analytics_events
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY event_type
      ORDER BY count DESC
    `, [startDate, endDate]);
    return result.rows;
  }

  // Среднее количество треков на пользователя
  async getAverageTracksPerUser() {
    const result = await this.pool.query(`
      SELECT AVG(track_count) as avg_tracks
      FROM (
        SELECT user_id, COUNT(*) as track_count
        FROM tracks
        GROUP BY user_id
      ) user_tracks
    `);
    return parseFloat(result.rows[0].avg_tracks || 0).toFixed(2);
  }

  // Retention rate (удержание пользователей)
  async getRetentionRate(days = 7) {
    const result = await this.pool.query(`
      WITH first_seen AS (
        SELECT user_id, MIN(created_at) as first_date
        FROM analytics_events
        GROUP BY user_id
        HAVING MIN(created_at) <= NOW() - INTERVAL '${days} days'
      ),
      returned AS (
        SELECT DISTINCT ae.user_id
        FROM analytics_events ae
        INNER JOIN first_seen fs ON ae.user_id = fs.user_id
        WHERE ae.created_at > fs.first_date + INTERVAL '${days} days'
      )
      SELECT 
        COUNT(DISTINCT fs.user_id) as total_users,
        COUNT(DISTINCT r.user_id) as returned_users,
        ROUND(COUNT(DISTINCT r.user_id)::numeric / COUNT(DISTINCT fs.user_id) * 100, 2) as retention_rate
      FROM first_seen fs
      LEFT JOIN returned r ON fs.user_id = r.user_id
    `);
    return result.rows[0];
  }

  // Dashboard данные
  async getDashboardStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [dau, mau, uploads, avgTracks, retention] = await Promise.all([
      this.getDailyActiveUsers(today),
      this.getMonthlyActiveUsers(now.getFullYear(), now.getMonth() + 1),
      this.getUploadsCount(thirtyDaysAgo, now),
      this.getAverageTracksPerUser(),
      this.getRetentionRate(7),
    ]);

    return {
      dau,
      mau,
      uploads_30d: uploads,
      avg_tracks_per_user: avgTracks,
      retention_7d: retention.retention_rate,
      dau_mau_ratio: mau > 0 ? ((dau / mau) * 100).toFixed(2) : 0,
    };
  }
}

module.exports = {
  initAnalyticsTable,
  Analytics,
};
