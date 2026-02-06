// =============================================
// SEARCH ROUTES
// Маршруты для поиска и скачивания треков
// =============================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const musicSearch = require('../services/musicSearch');
const analytics = require('../analytics');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------------------------------------------
// Поиск по всем трекам (скачанные + доступные)
// ---------------------------------------------

router.get('/all', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    const userId = req.userId;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Параметр q (запрос) обязателен' });
    }

    // Трекинг аналитики
    analytics.trackEvent(userId, 'music_search', { query: q });

    // 1. Ищем в скачанных треках пользователя
    const myTracksResult = await pool.query(
      `SELECT id, name as title, url, created_at, 'my_library' as source, true as is_downloaded
       FROM tracks 
       WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, `%${q}%`, limit]
    );

    const myTracks = myTracksResult.rows.map(track => ({
      ...track,
      artist: 'Моя библиотека',
      isDownloaded: true
    }));

    // 2. Ищем во внешних источниках
    const externalResult = await musicSearch.searchAllSources(q, limit);
    
    const externalTracks = externalResult.success 
      ? externalResult.tracks.map(track => ({
          ...track,
          isDownloaded: false
        }))
      : [];

    // 3. Объединяем результаты (сначала скачанные)
    const allTracks = [
      ...myTracks,
      ...externalTracks
    ].slice(0, limit);

    res.json({
      success: true,
      query: q,
      count: allTracks.length,
      tracks: allTracks,
      stats: {
        myLibrary: myTracks.length,
        external: externalTracks.length,
        sources: externalResult.sources || {}
      }
    });
  } catch (error) {
    console.error('❌ Ошибка поиска:', error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// ---------------------------------------------
// Поиск только во внешних источниках
// ---------------------------------------------

router.get('/external', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    const userId = req.userId;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Параметр q обязателен' });
    }

    analytics.trackEvent(userId, 'external_search', { query: q });

    const result = await musicSearch.searchAllSources(q, limit);

    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка внешнего поиска:', error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// ---------------------------------------------
// Скачивание трека из внешнего источника
// ---------------------------------------------

router.post('/download', async (req, res) => {
  try {
    const { previewUrl, title, artist } = req.body;
    const userId = req.userId;

    if (!previewUrl || !title) {
      return res.status(400).json({ error: 'Не указаны previewUrl и title' });
    }

    // Скачиваем превью
    const downloadResult = await musicSearch.downloadPreview(previewUrl);

    if (!downloadResult.success) {
      return res.status(500).json({ error: 'Не удалось скачать трек' });
    }

    // Загружаем в Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video', 
          folder: `arabutka/${userId}`,
          public_id: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(downloadResult.buffer);
    });

    // Сохраняем в базу данных
    const trackName = artist ? `${artist} - ${title}` : title;
    const dbResult = await pool.query(
      'INSERT INTO tracks (user_id, name, url, cloudinary_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, trackName, uploadResult.secure_url, uploadResult.public_id]
    );

    // Аналитика
    analytics.trackEvent(userId, 'track_downloaded_from_search', {
      title,
      artist,
      source: 'external'
    });

    res.json({
      success: true,
      message: 'Трек успешно добавлен в вашу библиотеку',
      track: dbResult.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка скачивания:', error.message);
    res.status(500).json({ error: 'Ошибка скачивания трека' });
  }
});

module.exports = router;
