// cobaltDownloader.js
// Сервис для скачивания музыки с YouTube через play-dl

const play = require('play-dl');
const { searchYouTube } = require('./ytsr');

// -----------------------------------------------
// Конфигурация
// -----------------------------------------------

const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 МБ лимит

/**
 * Скачивает аудио с YouTube используя play-dl
 * @param {string} videoUrl - URL видео YouTube
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadYouTubeAudio(videoUrl) {
  try {
    console.log('[YouTube] Начинаем скачивание аудио от:', videoUrl);

    const stream = await play.stream(videoUrl, { quality: 2 });
    console.log('[YouTube] Стрим получен, тип:', stream.type);

    const chunks = [];
    let totalSize = 0;

    return new Promise((resolve, reject) => {
      stream.stream.on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;

        if (totalSize > MAX_AUDIO_SIZE) {
          stream.stream.destroy();
          reject(new Error('Файл слишком большой (максимум 50 МБ)'));
        }
      });

      stream.stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[YouTube] Скачано ${(buffer.length / 1024 / 1024).toFixed(2)} МБ`);

        if (buffer.length === 0) {
          return resolve({ success: false, error: 'Получен пустой файл' });
        }

        resolve({ success: true, buffer });
      });

      stream.stream.on('error', (error) => {
        console.error('[YouTube] Ошибка стрима:', error.message);
        reject(error);
      });
    });

  } catch (error) {
    console.error('[YouTube] Ошибка:', error.message);

    if (error.message.includes('Sign in')) {
      return { success: false, error: 'Видео требует авторизацию' };
    }
    if (error.message.includes('unavailable') || error.message.includes('private')) {
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

    // Скачиваем аудио через play-dl
    console.log('\n[YouTube] Начинаем скачивание через play-dl...');
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
