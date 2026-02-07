// cobaltDownloader.js
// Сервис для скачивания музыки через Cobalt API

const axios = require('axios');
const { searchYouTube } = require('./ytsr');

const COBALT_API = 'https://api.cobalt.tools/api/json';
const DOWNLOAD_TIMEOUT = 120000; // 2 минуты

/**
 * Получает URL для скачивания аудио через Cobalt API
 * @param {string} videoUrl - URL видео YouTube
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function getDownloadUrl(videoUrl) {
  try {
    const response = await axios.post(COBALT_API, {
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
    
    return { success: false, error: 'Не удалось получить ссылку на скачивание' };
  } catch (error) {
    console.error('Ошибка Cobalt API:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Скачивает аудио файл по URL
 * @param {string} url - URL аудио файла
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadAudio(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    return { success: true, buffer: Buffer.from(response.data) };
  } catch (error) {
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
    
    // Получение ссылки через Cobalt
    const downloadUrlResult = await getDownloadUrl(track.url);
    
    if (!downloadUrlResult.success) {
      return { success: false, error: downloadUrlResult.error };
    }

    // Скачивание файла
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
