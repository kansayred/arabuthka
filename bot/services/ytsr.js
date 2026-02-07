// ytsr.js
// Сервис для поиска видео на YouTube

const ytsr = require('ytsr');

/**
 * Поиск видео на YouTube
 * @param {string} query - Поисковый запрос
 * @param {number} limit - Максимальное количество результатов
 * @returns {Promise<{success: boolean, videos?: Array, error?: string}>}
 */
async function searchYouTube(query, limit = 5) {
  try {
    // Добавляем "audio" для лучшего поиска музыки
    const searchQuery = query.includes('audio') ? query : `${query} audio`;
    
    const filters = await ytsr.getFilters(searchQuery);
    const videoFilter = filters.get('Type').get('Video');
        
    if (!videoFilter || !videoFilter.url) {
      console.error('Ошибка: не удалось получить фильтр видео');
      return { 
        success: false, 
        error: 'YouTube API: не удалось получить фильтр видео',
        videos: []
      };
    }
    
    const searchResults = await ytsr(videoFilter.url, { 
      limit: limit,
      requestOptions: {
        headers: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
        }
      }
    });

    const videos = searchResults.items
      .filter(item => item.type === 'video') && item.url
      .map(video => ({
        id: video.id,
        url: video.url,
        title: video.title,
        artist: video.author?.name || 'Неизвестный исполнитель',
        duration: video.duration,
        durationSeconds: parseDuration(video.duration),
        thumbnail: video.bestThumbnail?.url || video.thumbnails?.[0]?.url,
        views: video.views,
        uploadedAt: video.uploadedAt
      }));

    return {
      success: true,
      videos: videos,
      count: videos.length
    };
  } catch (error) {
    console.error('Ошибка поиска YouTube:', error.message);
    return {
      success: false,
      error: error.message,
      videos: []
    };
  }
}

/**
 * Парсинг длительности видео в секунды
 * @param {string} duration - Длительность в формате "MM:SS" или "HH:MM:SS"
 * @returns {number} Длительность в секундах
 */
function parseDuration(duration) {
  if (!duration) return 0;
  
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  
  return 0;
}

/**
 * Получение информации о видео по URL
 * @param {string} url - URL видео YouTube
 * @returns {Promise<{success: boolean, video?: object, error?: string}>}
 */
async function getVideoInfo(url) {
  try {
    // Извлекаем video ID из URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Неверный URL видео' };
    }

    // Ищем видео по ID
    const searchResult = await searchYouTube(`https://youtube.com/watch?v=${videoId}`, 1);
    
    if (searchResult.success && searchResult.videos.length > 0) {
      return {
        success: true,
        video: searchResult.videos[0]
      };
    }

    return { success: false, error: 'Видео не найдено' };
  } catch (error) {
    console.error('Ошибка получения инфо о видео:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Извлечение ID видео из YouTube URL
 * @param {string} url - URL видео
 * @returns {string|null} ID видео или null
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

module.exports = {
  searchYouTube,
  getVideoInfo,
  extractVideoId,
  parseDuration
};
