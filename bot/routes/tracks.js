// =============================================
// TRACK ROUTES
// Маршруты для управления треками пользователя
// =============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { uploadToS3, deleteFromS3 } = require('../services/s3');

// =============================================
// КОНФИГУРАЦИЯ ЗАГРУЗКИ
// =============================================

const ALLOWED_MIMES = [
  'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'
];
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const isMimeOk = ALLOWED_MIMES.includes(file.mimetype);
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    const isExtOk = ALLOWED_EXTENSIONS.includes(ext);
    if (isMimeOk || isExtOk) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат. Разрешены: MP3, WAV, OGG, M4A, AAC'));
    }
  }
});

// =============================================
// RATE LIMITING (загрузка)
// =============================================

const rateLimit = require('express-rate-limit');
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много загрузок, попробуй позже' }
});

// =============================================
// POST /upload — Загрузка трека
// =============================================

router.post('/upload', uploadLimiter, upload.single('track'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не прикреплён' });
    }

    const userId = req.userId;
    logger.userAction(userId, 'upload_start', {
      filename: req.file.originalname,
      size: req.file.size
    });

    // Загрузка в Selectel S3
    const s3Key = `arabutka/${userId}/track_${Date.now()}`;
    const fileUrl = await uploadToS3(
      req.file.buffer,
      s3Key,
      req.file.mimetype || 'audio/mpeg'
    );

    const originalName = req.file.originalname;
    const name = originalName.replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '');

    const dbResult = await pool.query(
      'INSERT INTO tracks (user_id, name, url, s3_key) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, name, fileUrl, s3Key]
    );

    logger.userAction(userId, 'upload_success', {
      trackId: dbResult.rows[0].id,
      name
    });

    res.json({ success: true, track: dbResult.rows[0] });
  } catch (error) {
    logger.error('Ошибка загрузки', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой (максимум 25 МБ)' });
    }
    res.status(500).json({ error: error.message || 'Ошибка загрузки' });
  }
});

// =============================================
// GET /tracks — Список треков пользователя
// =============================================

router.get('/tracks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Неверные параметры: page >= 1, limit от 1 до 100'
      });
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM tracks WHERE user_id = $1',
      [req.userId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM tracks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.userId, limit, offset]
    );

    res.json({
      tracks: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Ошибка получения треков', error);
    res.status(500).json({ error: 'Не удалось получить треки' });
  }
});

// =============================================
// DELETE /tracks/:id — Удаление трека
// =============================================

router.delete('/tracks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Неверный ID' });
    }

    const track = await pool.query(
      'SELECT * FROM tracks WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (track.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Трек не найден' });
    }

    // Удаляем файл из S3
    if (track.rows[0].s3_key) {
      await deleteFromS3(track.rows[0].s3_key);
    }

    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);

    logger.userAction(req.userId, 'track_deleted', { trackId: id });
    res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка удаления', err);
    res.status(500).json({ success: false, error: 'Ошибка удаления' });
  }
});

module.exports = router;
