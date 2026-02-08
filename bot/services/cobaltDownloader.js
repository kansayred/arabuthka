// cobaltDownloader.js
// Сервис для скачивания музыки с YouTube через youtubei.js

const https = require('https');
const http = require('http');

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

    // Получаем полную информацию о видео
    const info = await yt.getInfo(videoId);

    // Ищем аудио формат который НЕ требует decipher (имеет прямой URL)
    const audioFormats = info.streaming_data?.adaptive_formats?.filter(f => 
      f.mime_type?.includes('audio') && f.url
    ) || [];

    if (audioFormats.length === 0) {
      console.error('[YouTube] Не найдены аудио форматы с прямым URL');
      return { success: false, error: 'Не найдены доступные аудио форматы' };
    }

    // Выбираем лучший аудио формат (по bitrate)
    const bestFormat = audioFormats.sort((a, b) => 
      (b.bitrate || 0) - (a.bitrate || 0)
    )[0];

    console.log('[YouTube] Выбран формат:', bestFormat.mime_type, 'bitrate:', bestFormat.bitrate);
    console.log('[YouTube] URL:', bestFormat.url.substring(0, 100) + '...');

    // Скачиваем через прямой URL
    const buffer = await downloadFromUrl(bestFormat.url);

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
 * Скачивает файл по URL и возвращает Buffer
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function downloadFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      // Обработка редиректов
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFromUrl(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error('HTTP статус: ' + response.statusCode));
      }

      const chunks = [];
      let totalSize = 0;

      response.on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        if (totalSize > MAX_AUDIO_SIZE) {
          response.destroy();
          reject(new Error('Файл слишком большой (максимум 50 МБ)'));
        }
      });

      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      response.on('error', (err) => {
        reject(err);
      });
    }).on('error', (err) => {
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
