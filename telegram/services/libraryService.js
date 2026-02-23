// libraryService.js
// Сервис для работы с библиотекой треков пользователя

const { Pool } = require('pg');
const { uploadToS3, deleteFromS3 } = require('../../bot/services/s3');

// Инициализация подключения к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


/**
 * Сохраняет трек в библиотеку пользователя
 * @param {number} userId - Telegram ID пользователя
 * @param {Buffer} audioBuffer - Буфер аудио файла
 * @param {Object} trackInfo - Информация о треке
 * @returns {Promise<{success: boolean, track?: object, error?: string}>}
 */
async function saveTrackToLibrary(userId, audioBuffer, trackInfo) {
  try {
        // Загрузка в Selectel S3
    const s3Key = `arabutka/${userId}/track_${Date.now()}`;
    const fileUrl = await uploadToS3(audioBuffer, s3Key, 'audio/mpeg');

    // Сохраняем в базу данных
    const result = await pool.query(
      `INSERT INTO tracks (user_id, name, url, s3_key, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING *`,
            [userId, trackInfo.title, fileUrl, s3Key]
    );

    return {
      success: true,
      track: result.rows[0]
    };
  } catch (error) {
    console.error('Ошибка сохранения в библиотеку:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Получает библиотеку треков пользователя
 * @param {number} userId - Telegram ID пользователя
 * @param {number} limit - Максимальное количество треков
 * @returns {Promise<{success: boolean, tracks?: Array, error?: string}>}
 */
async function getUserLibrary(userId, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    return {
      success: true,
      tracks: result.rows,
      count: result.rows.length
    };
  } catch (error) {
    console.error('Ошибка получения библиотеки:', error.message);
    return {
      success: false,
      error: error.message,
      tracks: []
    };
  }
}

/**
 * Удаляет трек из библиотеки
 * @param {number} userId - Telegram ID пользователя
 * @param {number} trackId - ID трека
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFromLibrary(userId, trackId) {
  try {
    // Проверяем, что трек принадлежит пользователю
    const track = await pool.query(
      'SELECT * FROM tracks WHERE id = $1 AND user_id = $2',
      [trackId, userId]
    );

    if (track.rows.length === 0) {
      return { success: false, error: 'Трек не найден' };
    }

        // Удаляем из Selectel S3
    if (track.rows[0].s3_key) {
      await deleteFromS3(track.rows[0].s3_key);
    }

    // Удаляем из БД
    await pool.query('DELETE FROM tracks WHERE id = $1', [trackId]);

    return { success: true };
  } catch (error) {
    console.error('Ошибка удаления трека:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  saveTrackToLibrary,
  getUserLibrary,
  deleteFromLibrary
};
