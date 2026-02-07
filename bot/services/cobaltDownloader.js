// cobaltDownloader.js
// Сервис для скачивания музыки через Cobalt API

const axios = require('axios');
const { searchYouTube } = require('./ytsr');

// ---------------------------------------------
// Конфигурация
// ---------------------------------------------

// Список Cobalt-инстансов с поддержкой YouTube (по приоритету)
const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://cobalt-api.meowing.de/api/json',
  'https://capi.3kh0.net/api/json'
];

const DOWNLOAD_TIMEOUT = 10000; // 10 секунд на каждый инстанс Cobaltconst MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 МБ лимит буфера

/**
 * Получает URL для скачивания аудио через Cobalt API с фоллбэком
 * @param {string} videoUrl - URL видео YouTube
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function getDownloadUrl(videoUrl) {
  let lastError = 'Все Cobalt-инстансы недоступны';

  for (const apiUrl of COBALT_INSTANCES) {
    try {
      const response = await axios.post(apiUrl, {
        url: videoUrl,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        isAudioOnly: true,
        isNoTTWatermark: true,
        isTTFullAudio: true
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: DOWNLOAD_TIMEOUT
      });

      if (response.data && response.data.url) {
        return { success: true, url: response.data.url };
      }
    } catch (error) {
      lastError = error.message;
      console.warn(`Cobalt инстанс ${apiUrl} недоступен:`, error.message);
      // Пробуем следующий инстанс
    }
  }

  return { success: false, error: `Не удалось получить ссылку: ${lastError}` };
}

/**
 * Скачивает аудио файл по URL с проверкой размера
 * @param {string} url - URL аудио файла
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadAudio(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_AUDIO_SIZE,
      maxBodyLength: MAX_AUDIO_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const buffer = Buffer.from(response.data);

    // Дополнительная проверка размера
    if (buffer.length > MAX_AUDIO_SIZE) {
      return { success: false, error: `Файл слишком большой (${Math.round(buffer.length / 1024 / 1024)} МБ, максимум 50 МБ)` };
    }

    return { success: true, buffer };
  } catch (error) {
    if (error.code === 'ERR_BAD_RESPONSE' || error.message.includes('maxContentLength')) {
      return { success: false, error: 'Файл слишком большой (максимум 50 МБ)' };
    }
    console.error('Ошибка скачивания:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Поиск и скачивание трека
 * @param {string} query - Поисковый запрос
 * @returns {Promise<{success: boolean, buffer?: Buffer, track?: object, error?: string}>}
 */
async function searchAndDownload(query) {
  try {
    // Поиск через ytsr
    const searchResult = await searchYouTube(query);
    
    if (!searchResult.success || !searchResult.videos.length) {
      return { success: false, error: 'Трек не найден' };
    }

    const track = searchResult.videos[0];
    
    // Получение ссылки через Cobalt (с фоллбэком)
    const downloadUrlResult = await getDownloadUrl(track.url);
    
    if (!downloadUrlResult.success) {
      return { success: false, error: downloadUrlResult.error };
    }

    // Скачивание файла (с лимитом размера)
    const downloadResult = await downloadAudio(downloadUrlResult.url);
    
    if (!downloadResult.success) {
      return downloadResult;
    }

    return {
      success: true,
      buffer: downloadResult.buffer,
      track: {
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        thumbnail: track.thumbnail,
        url: track.url
      }
    };
  } catch (error) {
    console.error('Ошибка searchAndDownload:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getDownloadUrl,
  downloadAudio,
  searchAndDownload
};
