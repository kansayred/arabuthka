// =============================================
// PLAYLIST ROUTES
// Маршруты для управления плейлистами
// =============================================

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const logger = require('../utils/logger');

// =============================================
// КОНФИГУРАЦИЯ
// =============================================
const MAX_PLAYLISTS_PER_USER = 50;
const MAX_PLAYLIST_NAME = 100;
const MAX_DESCRIPTION = 500;
const MAX_TRACKS_PER_PLAYLIST = 200;

// =============================================
// GET / — Все плейлисты пользователя
// =============================================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, COUNT(pt.id)::int AS track_count
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [req.userId]
    );
    res.json({ playlists: result.rows });
  } catch (error) {
    logger.error('Ошибка получения плейлистов', error);
    res.status(500).json({ error: 'Не удалось получить плейлисты' });
  }
});

// =============================================
// POST / — Создать плейлист
// =============================================
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название плейлиста обязательно' });
    }

    if (name.trim().length > MAX_PLAYLIST_NAME) {
      return res.status(400).json({ error: `Название не должно превышать ${MAX_PLAYLIST_NAME} символов` });
    }

    if (description && description.length > MAX_DESCRIPTION) {
      return res.status(400).json({ error: `Описание не должно превышать ${MAX_DESCRIPTION} символов` });
    }

    // Проверяем лимит плейлистов
    const countResult = await pool.query(
      'SELECT COUNT(*)::int FROM playlists WHERE user_id = $1',
      [req.userId]
    );
    if (countResult.rows[0].count >= MAX_PLAYLISTS_PER_USER) {
      return res.status(400).json({ error: `Максимум ${MAX_PLAYLISTS_PER_USER} плейлистов` });
    }

    const result = await pool.query(
      'INSERT INTO playlists (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, name.trim(), description ? description.trim() : null]
    );

    logger.userAction(req.userId, 'playlist_created', { playlistId: result.rows[0].id, name: name.trim() });
    res.status(201).json({ success: true, playlist: result.rows[0] });
  } catch (error) {
    logger.error('Ошибка создания плейлиста', error);
    res.status(500).json({ error: 'Не удалось создать плейлист' });
  }
});

// =============================================
// GET /:id — Плейлист с треками
// =============================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
        const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({ error: 'Неверный ID плейлиста' });
    }

    const playlist = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (playlist.rows.length === 0) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const tracks = await pool.query(
      `SELECT t.*, pt.position, pt.added_at AS added_to_playlist
       FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id = $1
       ORDER BY pt.position ASC, pt.added_at ASC`,
      [id]
    );

    res.json({
      playlist: playlist.rows[0],
      tracks: tracks.rows
    });
  } catch (error) {
    logger.error('Ошибка получения плейлиста', error);
    res.status(500).json({ error: 'Не удалось получить плейлист' });
  }
});

// =============================================
// PUT /:id — Обновить плейлист
// =============================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
        const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({ error: 'Неверный ID плейлиста' });
    }
    const { name, description } = req.body;

    if (name && name.trim().length > MAX_PLAYLIST_NAME) {
      return res.status(400).json({ error: `Название не должно превышать ${MAX_PLAYLIST_NAME} символов` });
    }

    if (description && description.length > MAX_DESCRIPTION) {
      return res.status(400).json({ error: `Описание не должно превышать ${MAX_DESCRIPTION} символов` });
    }

    // Проверяем владельца
    const existing = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description ? description.trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нечего обновлять' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, req.userId);

    const result = await pool.query(
      `UPDATE playlists SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.userAction(req.userId, 'playlist_updated', { playlistId: id });
    res.json({ success: true, playlist: result.rows[0] });
  } catch (error) {
    logger.error('Ошибка обновления плейлиста', error);
    res.status(500).json({ error: 'Не удалось обновить плейлист' });
  }
});

// =============================================
// DELETE /:id — Удалить плейлист
// =============================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
        const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({ error: 'Неверный ID плейлиста' });
    }

    const result = await pool.query(
      'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    logger.userAction(req.userId, 'playlist_deleted', { playlistId: id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления плейлиста', error);
    res.status(500).json({ error: 'Не удалось удалить плейлист' });
  }
});

// =============================================
// POST /:id/tracks — Добавить трек в плейлист
// =============================================
router.post('/:id/tracks', async (req, res) => {
  try {
    const { id } = req.params;
        const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({ error: 'Неверный ID плейлиста' });
    }
    const { trackId } = req.body;

    if (!trackId) {
      return res.status(400).json({ error: 'trackId обязателен' });
    }

    // Проверяем владельца плейлиста
    const playlist = await pool.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (playlist.rows.length === 0) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    // Проверяем владельца трека
    const track = await pool.query(
      'SELECT id FROM tracks WHERE id = $1 AND user_id = $2',
      [trackId, req.userId]
    );
    if (track.rows.length === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    // Проверяем лимит треков в плейлисте
    const trackCount = await pool.query(
      'SELECT COUNT(*)::int FROM playlist_tracks WHERE playlist_id = $1',
      [id]
    );
    if (trackCount.rows[0].count >= MAX_TRACKS_PER_PLAYLIST) {
      return res.status(400).json({ error: `Максимум ${MAX_TRACKS_PER_PLAYLIST} треков в плейлисте` });
    }

    // Определяем позицию (в конец)
    const maxPos = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM playlist_tracks WHERE playlist_id = $1',
      [id]
    );

    const result = await pool.query(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3) RETURNING *',
      [id, trackId, maxPos.rows[0].next_pos]
    );

    // Обновляем updated_at плейлиста
    await pool.query('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    logger.userAction(req.userId, 'track_added_to_playlist', { playlistId: id, trackId });
    res.status(201).json({ success: true, entry: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Трек уже в плейлисте' });
    }
    logger.error('Ошибка добавления трека в плейлист', error);
    res.status(500).json({ error: 'Не удалось добавить трек' });
  }
});

// =============================================
// DELETE /:id/tracks/:trackId — Убрать трек из плейлиста
// =============================================
router.delete('/:id/tracks/:trackId', async (req, res) => {
  try {
    const { id, trackId } = req.params;
        const parsedId = parseInt(id);
    const parsedTrackId = parseInt(trackId);
    if (isNaN(parsedId) || parsedId < 1 || isNaN(parsedTrackId) || parsedTrackId < 1) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    // Проверяем владельца плейлиста
    const playlist = await pool.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (playlist.rows.length === 0) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const result = await pool.query(
      'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2 RETURNING id',
      [id, trackId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Трек не найден в плейлисте' });
    }

    // Обновляем updated_at плейлиста
    await pool.query('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    logger.userAction(req.userId, 'track_removed_from_playlist', { playlistId: id, trackId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления трека из плейлиста', error);
    res.status(500).json({ error: 'Не удалось убрать трек' });
  }
});

module.exports = router;
