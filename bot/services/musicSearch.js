// =============================================
// MUSIC SEARCH SERVICE
// Сервис для поиска музыки через внешние API
// =============================================

const axios = require('axios');
const logger = require('../utils/logger');

// ---------------------------------------------
// Поиск через iTunes API (бесплатный, легальный)
// ---------------------------------------------

async function searchItunes(query, limit = 20) {
  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: query,
        media: 'music',
        entity: 'song',
        limit: limit
      }
    });

    const results = response.data.results.map(track => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      duration: Math.floor(track.trackTimeMillis / 1000), // в секундах
      artwork: track.artworkUrl100.replace('100x100', '300x300'), // HD обложка
      previewUrl: track.previewUrl, // 30-секундный превью
      releaseDate: track.releaseDate,
      genre: track.primaryGenreName,
      source: 'itunes'
    }));

    return {
      success: true,
      count: results.length,
      tracks: results
    };
  } catch (error) {
    logger.error('❌ Ошибка поиска в iTunes:', error.message);
    return {
      success: false,
      error: error.message,
      tracks: []
    };
  }
}

// ---------------------------------------------
// Поиск через Deezer API (бесплатный)
// ---------------------------------------------

async function searchDeezer(query, limit = 20) {
  try {
    const response = await axios.get('https://api.deezer.com/search', {
      params: {
        q: query,
        limit: limit
      }
    });

    const results = response.data.data.map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      duration: track.duration,
      artwork: track.album.cover_medium,
      previewUrl: track.preview, // 30-секундный превью
      releaseDate: track.release_date,
      source: 'deezer'
    }));

    return {
      success: true,
      count: results.length,
      tracks: results
    };
  } catch (error) {
    logger.error('❌ Ошибка поиска в Deezer:', error.message);
    return {
      success: false,
      error: error.message,
      tracks: []
    };
  }
}

// ---------------------------------------------
// Объединенный поиск по всем источникам
// ---------------------------------------------

async function searchAllSources(query, limit = 20) {
  try {
    // Запускаем поиск параллельно
    const [itunesResult, deezerResult] = await Promise.allSettled([
      searchItunes(query, Math.ceil(limit / 2)),
      searchDeezer(query, Math.ceil(limit / 2))
    ]);

    let allTracks = [];

    // Собираем результаты из iTunes
    if (itunesResult.status === 'fulfilled' && itunesResult.value.success) {
      allTracks = allTracks.concat(itunesResult.value.tracks);
    }

    // Собираем результаты из Deezer
    if (deezerResult.status === 'fulfilled' && deezerResult.value.success) {
      allTracks = allTracks.concat(deezerResult.value.tracks);
    }

    // Удаляем дубликаты (по названию + артист)
    const uniqueTracks = [];
    const seen = new Set();

    for (const track of allTracks) {
      const key = `${track.title.toLowerCase()}_${track.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(track);
      }
    }

    // Ограничиваем количество результатов
    const limitedTracks = uniqueTracks.slice(0, limit);

    return {
      success: true,
      count: limitedTracks.length,
      tracks: limitedTracks,
      sources: {
        itunes: itunesResult.status === 'fulfilled' ? itunesResult.value.count : 0,
        deezer: deezerResult.status === 'fulfilled' ? deezerResult.value.count : 0
      }
    };
  } catch (error) {
    logger.error('❌ Ошибка объединенного поиска:', error.message);
    return {
      success: false,
      error: error.message,
      tracks: []
    };
  }
}

// ---------------------------------------------
// Скачивание превью трека
// ---------------------------------------------

async function downloadPreview(previewUrl) {
  try {
    const response = await axios({
      url: previewUrl,
      method: 'GET',
      responseType: 'arraybuffer'
    });

    return {
      success: true,
      buffer: response.data,
      contentType: response.headers['content-type']
    };
  } catch (error) {
    logger.error('❌ Ошибка скачивания превью:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ---------------------------------------------
// Экспорт
// ---------------------------------------------

module.exports = {
  searchItunes,
  searchDeezer,
  searchAllSources,
  downloadPreview
};
