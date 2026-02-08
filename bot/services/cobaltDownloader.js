// cobaltDownloader.js
// Сервис для скачивания музыки с YouTube через @distube/ytdl-core

const ytdl = require('@distube/ytdl-core');

// -----------------------------------------------
// Конфигурация
// -----------------------------------------------

const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 МБ лимит

/**
 * Скачивает аудио с YouTube по video ID
 * @param {string} videoId - ID видео YouTube
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadYouTubeAudio(videoId) {
  try {
    console.log('[YouTube] Начинаем скачивание аудио, videoId:', videoId);
    
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Проверяем доступность видео
    if (!ytdl.validateURL(url)) {
      return { success: false, error: 'Неверный URL YouTube' };
    }
    
    // Получаем информацию о видео
    const info = await ytdl.getInfo(url);
    
    // Выбираем лучший аудио формат
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (audioFormats.length === 0) {
      return { success: false, error: 'Не найдены аудио форматы' };
    }
    
    // Сортируем по битрейту и выбираем лучший
    const bestFormat = audioFormats.sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
    
    console.log('[YouTube] Выбран формат:', bestFormat.mimeType, 'bitrate:', bestFormat.audioBitrate);
    
    // Скачиваем аудио
    const stream = ytdl(url, { format: bestFormat });
    const buffer = await streamToBuffer(stream);
    
    if (!buffer || buffer.length === 0) {
      return { success: false, error: 'Получен пустой файл' };
    }
    
    console.log('[YouTube] Скачано ' + (buffer.length / 1024 / 1024).toFixed(2) + ' МБ');
    return { success: true, buffer };
    
  } catch (error) {
    console.error('[YouTube] Ошибка:', error.message);
    
    if (error.message && error.message.includes('Sign in')) {
      return { success: false, error: 'Видео требует авторизацию' };
    }
    
    if (error.message && (error.message.includes('unavailable') || error.message.includes('private'))) {
      return { success: false, error: 'Видео недоступно' };
    }
    
    if (error.message && error.message.includes('429')) {
      return { success: false, error: 'Слишком много запросов к YouTube. Попробуйте позже' };
    }
    
    return { success: false, error: 'Ошибка скачивания: ' + error.message };
  }
}

/**
 * Конвертирует stream в Buffer
 * @param {Readable} stream 
 * @returns {Promise<Buffer>}
 */
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      totalSize += chunk.length;
      
      if (totalSize > MAX_AUDIO_SIZE) {
        stream.destroy();
        reject(new Error('Файл слишком большой (максимум 50 МБ)'));
      }
    });
    
    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Ищет трек на YouTube и скачивает аудио
 * @param {string} query - Поисковый запрос
 * @returns {Promise<{success: boolean, buffer?: Buffer, track?: object, error?: string}>}
 */
async function searchAndDownload(query) {
  try {
    console.log('\n[Search] ========== НАЧАЛО ПРОЦЕССА СКАЧИВАНИЯ ==========');
    console.log('[Search] Поисковый запрос:', query);
    
    // Используем ytsr для поиска (нужно установить отдельно)
    // Или делаем простой поиск через YouTube URL
    const ytsr = require('ytsr');
    
    const searchQuery = query + ' audio';
    const searchResults = await ytsr(searchQuery, { limit: 5 });
    
    const videos = searchResults.items.filter(item => item.type === 'video');
    
    console.log('[Search] Найдено видео:', videos.length);
    
    if (videos.length === 0) {
      console.error('[Search] Ничего не найдено');
      return {
        success: false,
        error: 'Ничего не найдено по запросу. Попробуйте изменить запрос.'
      };
    }
    
    const video = videos[0];
    const videoId = video.id;
    const videoTitle = video.title || query;
    const videoArtist = video.author?.name || 'Неизвестный исполнитель';
    const videoDuration = video.duration || '0:00';
    const videoThumbnail = video.bestThumbnail?.url || null;
    
    console.log('[Search] Найден трек:', {
      title: videoTitle,
      artist: videoArtist,
      id: videoId,
      duration: videoDuration
    });
    
    // Скачиваем аудио
    console.log('\n[YouTube] Начинаем скачивание...');
    const downloadResult = await downloadYouTubeAudio(videoId);
    
    if (downloadResult.success) {
      console.log('[YouTube] ========== УСПЕШНО СКАЧАНО ==========\n');
      return {
        success: true,
        buffer: downloadResult.buffer,
        track: {
          title: videoTitle,
          artist: videoArtist,
          duration: videoDuration,
          thumbnail: videoThumbnail,
          url: video.url
        }
      };
    } else {
      console.error('[YouTube] Скачивание не удалось:', downloadResult.error);
      return {
        success: false,
        error: downloadResult.error || 'Не удалось скачать аудио'
      };
    }
  } catch (error) {
    console.error('[CRITICAL] Критическая ошибка searchAndDownload:', error.message);
    console.error('[CRITICAL] Stack trace:', error.stack);
    return {
      success: false,
      error: 'Критическая ошибка: ' + error.message
    };
  }
}

module.exports = {
  downloadYouTubeAudio,
  searchAndDownload
};
