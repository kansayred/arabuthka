// s3.js — Клиент Selectel S3
// Единая точка подключения к объектному хранилищу.
// Хранение аудиофайлов в Selectel S3.

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

// Подключение к Selectel S3 (Санкт-Петербург, ru-1)
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://s3.ru-1.storage.selcloud.ru';

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: 'ru-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  },
  forcePathStyle: true // обязательно для Selectel
});

const BUCKET = process.env.S3_BUCKET_NAME || 'maneshkin';

/**
 * Загрузка файла в S3
 * @param {Buffer} buffer — буфер файла
 * @param {string} key — путь/имя объекта в бакете
 * @param {string} contentType — MIME-тип
  * @returns {Promise<string>} внутренний URL файла
 */
async function uploadToS3(buffer, key, contentType = 'audio/mpeg') {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'private'
  }));
  const url = `${S3_ENDPOINT}/${BUCKET}/${key}`;
  logger.info(`[S3] Загружен: ${key}`);
  return url;
}

/**
 * Получение файла из S3 (для прокси-стриминга)
 * @param {string} key — путь/имя объекта
 * @returns {Promise<{Body: ReadableStream, ContentType: string, ContentLength: number}>}
 */

async function getFromS3(key) {
  const { Readable } = require('stream');
  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
  // AWS SDK v3 returns Body as a web ReadableStream.
  // Convert to Node.js Readable for .pipe() compatibility.
  let body = response.Body;
  if (body && typeof body.pipe !== 'function') {
    // Body is a web ReadableStream, convert to Node.js stream
    if (typeof Readable.fromWeb === 'function') {
      body = Readable.fromWeb(body);
    } else if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      body = Readable.from(Buffer.from(bytes));
    }
  }
  return {
    Body: body,
    ContentType: response.ContentType,
    ContentLength: response.ContentLength
  };
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

module.exports = { uploadToS3, deleteFromS3, getFromS3, BUCKET };
