// libraryService.js
// Сервис для работы с библиотекой треков пользователя

const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

// Инициализация подключения к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Инициализация Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

/**
 * Сохраняет трек в библиотеку пользователя
 * @param {number} userId - Telegram ID пользователя
 * @param {Buffer} audioBuffer - Буфер аудио файла
 * @param {Object} trackInfo - Информация о треке
 * @returns {Promise<{success: boolean, track?: object, error?: string}>}
 */
async function saveTrackToLibrary(userId, audioBuffer, trackInfo) {
  try {
    // Загружаем в Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video', 
          folder: `arabutka/${userId}`,
          public_id: `track_${Date.now()}`
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(audioBuffer);
    });

    // Сохраняем в базу данных
    const result = await pool.query(
      `INSERT INTO tracks (user_id, name, url, cloudinary_id, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING *`,
      [userId, trackInfo.title, uploadResult.secure_url, uploadResult.public_id]
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

    // Удаляем из Cloudinary
    if (track.rows[0].cloudinary_id) {
      await cloudinary.uploader.destroy(track.rows[0].cloudinary_id, { 
        resource_type: 'video' 
      });
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
