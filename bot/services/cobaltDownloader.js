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
  console.log('[Cobalt] Попытка получить download URL для:', videoUrl);
  let lastError = 'Все Cobalt-инстансы недоступны';
  
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`[Cobalt] Попытка через ${instance}...`);
      
      const response = await axios.post(
        instance,
        {
          url: videoUrl,
          isAudioOnly: true,
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
      
      console.log(`[Cobalt] Ответ от ${instance}:`, JSON.stringify(response.data).substring(0, 200));
      
      if (response.data && (response.data.status === 'tunnel' || response.data.status === 'redirect') && response.data.url) {
        console.log(`[Cobalt] Успешно получен URL через ${instance}`);
        return { success: true, url: response.data.url };
      }
      
      if (response.data && response.data.status === 'error') {
        const errorCode = response.data.error?.code || 'unknown';
        lastError = `Cobalt ошибка (${instance}): ${errorCode}`;
        console.warn(`[Cobalt] ${lastError}`);
        continue;
      }
      
      lastError = `Cobalt: неожиданный ответ от ${instance}`;
      console.warn(`[Cobalt] ${lastError}`);
      
    } catch (error) {
      lastError = `Cobalt (${instance}): ${error.message}`;
      console.warn(`[Cobalt] ${lastError}`);
    }
  }
  
  console.error('[Cobalt] Все инстансы не удалось:', lastError);
  return { success: false, error: lastError };
}

/**
 * Скачивает аудиофайл по URL
 * @param {string} url - URL для скачивания
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadAudio(url) {
  try {
    console.log('[Download] Начинаем скачивание аудио от:', url.substring(0, 100));
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: MAX_AUDIO_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const buffer = Buffer.from(response.data);
    console.log(`[Download] Скачано ${(buffer.length / 1024 / 1024).toFixed(2)} МБ`);
    
    if (buffer.length === 0) {
      console.error('[Download] Получен пустой файл!');
      return { success: false, error: 'Получен пустой файл' };
    }
    
    return { success: true, buffer };
    
  } catch (error) {
    if (error.code === 'ERR_BAD_RESPONSE' || error.message.includes('maxContentLength')) {
      console.error('[Download] Файл слишком большой (>50МБ)');
      return { success: false, error: 'Файл слишком большой (максимум 50 МБ)' };
    }
    
    console.error('[Download] Ошибка скачивания:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Ищет трек и скачивает аудио
 * @param {string} query - Поисковый запрос
 * @returns {Promise<{success: boolean, buffer?: Buffer, track?: object, error?: string}>}
 */
async function searchAndDownload(query) {
  try {
    console.log('\n[Search] ========== НАЧАЛО ПРОЦЕССА СКАЧИВАНИЯ ==========');
    console.log('[Search] Поисковый запрос:', query);
    
    // Поиск трека на YouTube
    const searchResult = await searchYouTube(query);
    
    console.log('[Search] Результат поиска:', JSON.stringify({
      success: searchResult.success,
      videosCount: searchResult.videos?.length || 0,
      error: searchResult.error
    }));
    
    if (!searchResult.success) {
      console.error('[Search] Поиск не удался:', searchResult.error);
      return { success: false, error: `Ошибка поиска: ${searchResult.error}` };
    }
    
    if (!searchResult.videos || searchResult.videos.length === 0) {
      console.error('[Search] Ничего не найдено по запросу');
      return { success: false, error: 'Ничего не найдено по запросу. Попробуйте изменить запрос.' };
    }
    
    const track = searchResult.videos[0];
    console.log('[Search] Найден трек:', {
      title: track.title,
      artist: track.artist,
      url: track.url,
      duration: track.duration
    });
    
    // Попытка скачать через Cobalt API
    console.log('\n[Cobalt] Пробуем скачать через Cobalt API...');
    const downloadUrlResult = await getDownloadUrl(track.url);
    
    if (downloadUrlResult.success) {
      console.log('[Cobalt] URL получен, скачиваем...');
      const downloadResult = await downloadAudio(downloadUrlResult.url);
      
      if (downloadResult.success) {
        console.log('[Cobalt] ========== УСПЕШНО СКАЧАНО ==========\n');
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
      } else {
        console.warn('[Cobalt] URL получен, но скачивание не удалось:', downloadResult.error);
      }
    } else {
      console.warn('[Cobalt] Не смог получить download URL:', downloadUrlResult.error);
    }
    
    // Все способы не сработали
    console.error('[Download] ========== СКАЧИВАНИЕ НЕ УДАЛОСЬ ==========\n');
    return {
      success: false,
      error: 'Сервис загрузки временно недоступен. Попробуйте позже или выберите другой трек.'
    };
    
  } catch (error) {
    console.error('[CRITICAL] Критическая ошибка searchAndDownload:', error.message);
    console.error('[CRITICAL] Stack trace:', error.stack);
    return { success: false, error: `Критическая ошибка: ${error.message}` };
  }
}

module.exports = {
  getDownloadUrl,
  downloadAudio,
  searchAndDownload
};
