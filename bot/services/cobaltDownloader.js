// cobaltDownloader.js
// Сервис для скачивания музыки через Cobalt API

const axios = require('axios');
const { searchYouTube } = require('./ytsr');

// -----------------------------------------------
// Конфигурация
// -----------------------------------------------

// Список Cobalt-инстансов с поддержкой YouTube (по приоритету)
const COBALT_INSTANCES = [
  'https://cobalt-api.meowing.de/',
  'https://cobalt-backend.canine.tools/',
  'https://capi.3kh0.net/'
];

const DOWNLOAD_TIMEOUT = 10000; // 10 секунд на каждый инстанс Cobalt
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 МБ лимит буфера

/**
 * Получает URL для скачивания аудио через Cobalt API с фоллбэком
 * @param {string} videoUrl - URL видео YouTube
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function getDownloadUrl(videoUrl) {
  let lastError = 'Все Cobalt-инстансы недоступны';

  for (const instance of COBALT_INSTANCES) {
    try {
      const response = await axios.post(
        instance,
        {
          url: videoUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3'
        },
        {
          timeout: DOWNLOAD_TIMEOUT,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && (response.data.status === 'tunnel' || response.data.status === 'redirect') && response.data.url) {
        console.log(`Cobalt: получен URL через ${instance}`);
        return { success: true, url: response.data.url };
      }

      if (response.data && response.data.status === 'error') {
        const errorCode = response.data.error?.code || 'unknown';
        lastError = `Cobalt ошибка (${instance}): ${errorCode}`;
        console.warn(lastError);
        continue;
      }

      lastError = `Cobalt: неожиданный ответ от ${instance}`;
      console.warn(lastError);
    } catch (error) {
      lastError = `Cobalt (${instance}): ${error.message}`;
      console.warn(lastError);
    }
  }

  return { success: false, error: lastError };
}

/**
 * Скачивает аудиофайл по URL
 * @param {string} url - URL для скачивания
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadAudio(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: MAX_AUDIO_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const buffer = Buffer.from(response.data);
    if (buffer.length === 0) {
      return { success: false, error: 'Получен пустой файл' };
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
 * Fallback: скачивание через yt-dlp (youtube-dl-exec)
 * @param {string} videoUrl - URL видео YouTube
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadViaYtDlp(videoUrl) {
  try {
    const ytDlp = require('youtube-dl-exec');

    // Получаем прямую ссылку на аудио
    const result = await ytDlp(videoUrl, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '128K',
      getUrl: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true
    });

    // result содержит URL
    const audioUrl = typeof result === 'string' ? result.trim() : null;
    if (!audioUrl) {
      return { success: false, error: 'yt-dlp не вернул URL' };
    }

    // Скачиваем аудио по полученному URL
    const downloadResult = await downloadAudio(audioUrl);
    return downloadResult;
  } catch (error) {
    console.error('yt-dlp fallback ошибка:', error.message);
    return { success: false, error: `yt-dlp: ${error.message}` };
  }
}

/**
 * Ищет трек и скачивает аудио
 * @param {string} query - Поисковый запрос
 * @returns {Promise<{success: boolean, buffer?: Buffer, track?: object, error?: string}>}
 */
async function searchAndDownload(query) {
  try {
    // Поиск трека на YouTube
    const searchResult = await searchYouTube(query);

    // ytsr.js возвращает { success, videos }, НЕ tracks
    if (!searchResult.success || !searchResult.videos || !searchResult.videos.length) {
      return { success: false, error: 'Ничего не найдено по запросу' };
    }

    const track = searchResult.videos[0];

    // === Попытка 1: Cobalt API ===
    const downloadUrlResult = await getDownloadUrl(track.url);

    if (downloadUrlResult.success) {
      const downloadResult = await downloadAudio(downloadUrlResult.url);
      if (downloadResult.success) {
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
      }
    }

    // === Попытка 2: yt-dlp fallback ===
    console.warn('Cobalt недоступен, пробуем yt-dlp fallback...');
    const ytDlpResult = await downloadViaYtDlp(track.url);

    if (ytDlpResult.success) {
      return {
        success: true,
        buffer: ytDlpResult.buffer,
        track: {
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          thumbnail: track.thumbnail,
          url: track.url
        }
      };
    }

    // Оба способа не сработали
    return {
      success: false,
      error: 'Сервис загрузки временно недоступен. Все методы скачивания исчерпаны.'
    };
  } catch (error) {
    console.error('Ошибка searchAndDownload:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getDownloadUrl,
  downloadAudio,
  downloadViaYtDlp,
  searchAndDownload
};
