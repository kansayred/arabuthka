// cobaltDownloader.js
// Сервис для скачивания музыки с YouTube через youtubei.js

// -----------------------------------------------
// Конфигурация
// -----------------------------------------------

const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 МБ лимит

// Кешируем Innertube клиент
let _innertube = null;

async function getInnertube() {
  if (_innertube) return _innertube;
  const { Innertube } = await import('youtubei.js');
  _innertube = await Innertube.create({
    lang: 'ru',
    location: 'RU',
    generate_session_locally: true
  });
  return _innertube;
}

/**
 * Скачивает аудио с YouTube по video ID
 * @param {string} videoId - ID видео YouTube
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadYouTubeAudio(videoId) {
  try {
    console.log('[YouTube] Начинаем скачивание аудио, videoId:', videoId);

    const yt = await getInnertube();

    // Используем yt.download() для получения потока
    const stream = await yt.download(videoId, {
      type: 'audio',
      quality: 'best',
      format: 'mp4'
    });

    console.log('[YouTube] Поток получен, скачиваем...');

    // Скачиваем весь поток в Buffer
    const chunks = [];
    let totalSize = 0;

    for await (const chunk of stream) {
      chunks.push(chunk);
      totalSize += chunk.length;
      
      if (totalSize > MAX_AUDIO_SIZE) {
        throw new Error('Файл слишком большой (максимум 50 МБ)');
      }
    }

    const buffer = Buffer.concat(chunks);

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

    return { success: false, error: 'Ошибка скачивания: ' + error.message };
  }
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

    const yt = await getInnertube();

    // Поиск на YouTube через youtubei.js
    const searchQuery = query + ' audio';
    const searchResults = await yt.search(searchQuery, { type: 'video' });

    const videos = searchResults.results
      ? searchResults.results.filter(item => item.type === 'Video' && item.id)
      : [];

    console.log('[Search] Найдено видео:', videos.length);

    if (videos.length === 0) {
      console.error('[Search] Ничего не найдено');
      return { success: false, error: 'Ничего не найдено по запросу. Попробуйте изменить запрос.' };
    }

    const video = videos[0];
    const videoTitle = video.title ? video.title.toString() : query;
    const videoArtist = video.author ? video.author.name : 'Неизвестный исполнитель';
    const videoDuration = video.duration ? video.duration.text : '0:00';
    const videoThumbnail = video.thumbnails && video.thumbnails[0] ? video.thumbnails[0].url : null;

    console.log('[Search] Найден трек:', {
      title: videoTitle,
      artist: videoArtist,
      id: video.id,
      duration: videoDuration
    });

    // Скачиваем аудио
    console.log('\n[YouTube] Начинаем скачивание...');
    const downloadResult = await downloadYouTubeAudio(video.id);

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
          url: 'https://www.youtube.com/watch?v=' + video.id
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
    return { success: false, error: 'Критическая ошибка: ' + error.message };
  }
}

module.exports = {
  downloadYouTubeAudio,
  searchAndDownload
};
