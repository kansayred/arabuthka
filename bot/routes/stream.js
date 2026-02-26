// =============================================
// STREAM ROUTES
// Маршруты стриминга аудио — прокси через сервер
// Обходит CORS-ограничения Selectel S3
// =============================================

const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { getFromS3 } = require('../services/s3');

// =============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================

/**
 * Устанавливает стандартные заголовки для аудио-ответа
 * @param {Object} res - Express response
 * @param {string} contentType - MIME-тип
 * @param {string} name - Имя трека
 * @param {number|null} contentLength - Размер файла
 */
function setAudioHeaders(res, contentType, name, contentLength) {
  res.setHeader('Content-Type', contentType || 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(name)}.mp3"`
  );
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }
}

/**
 * Проксирует аудио через axios (для старых треков без s3_key)
 */
async function proxyViaUrl(url, name, res) {
  const axiosRes = await axios.get(url, {
    responseType: 'stream',
    timeout: 30000
  });
  setAudioHeaders(res, axiosRes.headers['content-type'], name, null);
  axiosRes.data.pipe(res);
}

/**
 * Стримит аудио из S3
 */
async function streamFromS3(s3Key, name, res) {
  const s3Response = await getFromS3(s3Key);

  setAudioHeaders(
    res,
    s3Response.ContentType,
    name,
    s3Response.ContentLength
  );

  logger.info(`[stream] S3 ответ: key=${s3Key}, type=${s3Response.ContentType}, size=${s3Response.ContentLength}`);

  // Обработка ошибок потока
  s3Response.Body.on('error', (err) => {
    logger.error('Ошибка стриминга из S3', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка воспроизведения' });
    }
  });

  // Стримим данные клиенту
  if (typeof s3Response.Body.pipe === 'function') {
    s3Response.Body.pipe(res);
  } else {
    // Fallback: Body не имеет pipe (редкий случай)
    logger.warn('[stream] Body не поддерживает pipe, конвертируем в буфер');
    const chunks = [];
    for await (const chunk of s3Response.Body) {
      chunks.push(chunk);
    }
    res.end(Buffer.concat(chunks));
  }
}

// =============================================
// GET /stream/:trackId — Стриминг аудио
// =============================================

router.get('/stream/:trackId', async (req, res) => {
  try {
    const trackId = parseInt(req.params.trackId);

    if (isNaN(trackId) || trackId < 1) {
      return res.status(400).json({ error: 'Неверный ID трека' });
    }

    // Получаем информацию о треке
    const result = await pool.query(
      'SELECT s3_key, name, url FROM tracks WHERE id = $1 AND user_id = $2',
      [trackId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    const { s3_key, name, url } = result.rows[0];

    // Стратегия 1: Нет s3_key — проксируем через URL
    if (!s3_key) {
      if (!url) {
        return res.status(404).json({ error: 'Файл не найден в хранилище' });
      }
      logger.warn(`[stream] Нет s3_key для трека ${trackId}, проксируем url`);
      return await proxyViaUrl(url, name, res);
    }

    // Стратегия 2: Есть s3_key — стримим из S3
    try {
      await streamFromS3(s3_key, name, res);
    } catch (s3Error) {
      // S3 ошибка — fallback на URL если доступен
      if (
        (s3Error.name === 'NoSuchKey' || s3Error.name === 'AccessDenied') &&
        url
      ) {
        logger.warn(`[stream] ${s3Error.name} для ${s3_key}, fallback на url`);
        return await proxyViaUrl(url, name, res);
      }
      throw s3Error;
    }
  } catch (error) {
    logger.error('Ошибка в /stream/:trackId', {
      trackId: req.params.trackId,
      error: error.message,
      stack: error.stack
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Ошибка воспроизведения',
        detail: error.message
      });
    }
  }
});

module.exports = router;
