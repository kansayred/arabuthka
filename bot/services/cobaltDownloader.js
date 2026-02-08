// musicDownloader.js
// Сервис для скачивания музыки с YouTube через ytdl-core

const ytdl = require('@distube/ytdl-core');
const { searchYouTube } = require('./ytsr');
const { Readable } = require('stream');

// -----------------------------------------------
// Конфигурация
// -----------------------------------------------

const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 МБ лимит

/**
 * Скачивает аудио с YouTube используя ytdl-core
 * @param {string} videoUrl - URL видео YouTube
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadYouTubeAudio(videoUrl) {
  try {
    console.log('[YouTube] Начинаем скачивание аудио от:', videoUrl);
    
    // Получаем информацию о видео
    const info = await ytdl.getInfo(videoUrl);
    console.log('[YouTube] Информация о видео получена:', info.videoDetails.title);
    
    // Фильтруем только аудио форматы
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (!audioFormats || audioFormats.length === 0) {
      console.error('[YouTube] Аудио форматы не найдены');
      return { success: false, error: 'Аудио форматы не найдены' };
    }
    
    // Выбираем формат с наивысшим битрейтом
    const bestAudio = audioFormats.sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
    console.log(`[YouTube] Выбран формат: ${bestAudio.container} (${bestAudio.audioBitrate}kbps)`);
    
    // Создаем стрим для скачивания
    const audioStream = ytdl.downloadFromInfo(info, { format: bestAudio });
    
    // Собираем данные в буфер
    const chunks = [];
    let totalSize = 0;
    
    return new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        
        // Проверяем лимит размера
        if (totalSize > MAX_AUDIO_SIZE) {
          audioStream.destroy();
          reject(new Error('Файл слишком большой (максимум 50 МБ)'));
        }
      });
      
      audioStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[YouTube] Скачано ${(buffer.length / 1024 / 1024).toFixed(2)} МБ`);
        resolve({ success: true, buffer });
      });
      
      audioStream.on('error', (error) => {
        console.error('[YouTube] Ошибка скачивания:', error.message);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('[YouTube] Ошибка при получении информации:', error.message);
    
    if (error.message.includes('Video unavailable')) {
      return { success: false, error: 'Видео недоступно' };
    }
    if (error.message.includes('too large')) {
      return { success: false, error: 'Файл слишком большой (максимум 50 МБ)' };
    }
    
    return { success: false, error: `Ошибка скачивания: ${error.message}` };
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
    
    // Скачиваем аудио через ytdl-core
    console.log('\n[YouTube] Начинаем скачивание через ytdl-core...');
    const downloadResult = await downloadYouTubeAudio(track.url);
    
    if (downloadResult.success) {
      console.log('[YouTube] ========== УСПЕШНО СКАЧАНО ==========\n');
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
      console.error('[YouTube] Скачивание не удалось:', downloadResult.error);
      return {
        success: false,
        error: downloadResult.error || 'Не удалось скачать аудио'
      };
    }
    
  } catch (error) {
    console.error('[CRITICAL] Критическая ошибка searchAndDownload:', error.message);
    console.error('[CRITICAL] Stack trace:', error.stack);
    return { success: false, error: `Критическая ошибка: ${error.message}` };
  }
}

module.exports = {
  downloadYouTubeAudio,
  searchAndDownload
};
