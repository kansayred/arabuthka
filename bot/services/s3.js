// s3.js — Клиент Selectel S3
// Единая точка подключения к объектному хранилищу.
// Используется вместо Cloudinary для хранения аудиофайлов.

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

// Подключение к Selectel S3 (Санкт-Петербург, ru-1)
const s3 = new S3Client({
  endpoint: 'https://s3.storage.selcloud.ru',
  region: 'ru-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  },
  forcePathStyle: true // обязательно для Selectel
});

const BUCKET = process.env.S3_BUCKET || 'maneshkin';

/**
 * Загрузка файла в S3
 * @param {Buffer} buffer — буфер файла
 * @param {string} key — путь/имя объекта в бакете
 * @param {string} contentType — MIME-тип
 * @returns {Promise<string>} публичный URL файла
 */
async function uploadToS3(buffer, key, contentType = 'audio/mpeg') {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  }));

  const url = `https://s3.storage.selcloud.ru/${BUCKET}/${key}`;
  logger.info(`[S3] Загружен: ${key}`);
  return url;
}

/**
 * Удаление файла из S3
 * @param {string} key — путь/имя объекта
 */
async function deleteFromS3(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
  logger.info(`[S3] Удалён: ${key}`);
}

module.exports = { uploadToS3, deleteFromS3, BUCKET };
