// =============================================
// YOUTUBE DOWNLOADER SERVICE  
// Скачивание полных треков через YouTube
// =============================================

const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const { PassThrough } = require('stream');

// ---------------------------------------------
// Поиск трека на YouTube
// ---------------------------------------------

async function searchYouTube(artist, title) {
  try {
    // Формируем запрос с "официальным аудио" для лучших результатов
    const query = `${artist} ${title} official audio`;
    const result = await ytSearch(query);

    if (!result || !result.videos || result.videos.length === 0) {
      return { success: false, error: 'Трек не найден на YouTube' };
    }

    // Берем первый результат (обычно самый релевантный)
    const video = result.videos[0];

    return {
      success: true,
      videoId: video.videoId,
      url: video.url,
      title: video.title,
      duration: video.timestamp, // например "3:45"
      thumbnail: video.thumbnail,
      views: video.views,
      author: video.author.name
    };
  } catch (error) {
    console.error('❌ Ошибка поиска на YouTube:', error.message);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------
// Скачивание аудио из YouTube
// ---------------------------------------------

async function downloadAudio(videoUrl) {
  try {
    // Проверяем валидность URL
    if (!ytdl.validateURL(videoUrl)) {
      return { success: false, error: 'Неверный YouTube URL' };
    }

    // Получаем информацию о видео
    const info = await ytdl.getInfo(videoUrl);
    
    // Создаем stream для скачивания только аудио
    const audioStream = ytdl(videoUrl, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    // Собираем данные в buffer
    const chunks = [];
    
    return new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      
      audioStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          success: true,
          buffer,
          title: info.videoDetails.title,
          duration: parseInt(info.videoDetails.lengthSeconds),
          author: info.videoDetails.author.name
        });
      });
      
      audioStream.on('error', (error) => {
        console.error('❌ Ошибка скачивания:', error.message);
        reject({ success: false, error: error.message });
      });
    });
  } catch (error) {
    console.error('❌ Ошибка скачивания с YouTube:', error.message);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------
// Поиск + скачивание в одном методе
// ---------------------------------------------

async function searchAndDownload(artist, title) {
  try {
    console.log(`🔎 Поиск на YouTube: ${artist} - ${title}`);
    
    // 1. Ищем трек
    const searchResult = await searchYouTube(artist, title);
    
    if (!searchResult.success) {
      return searchResult;
    }

    console.log(`✅ Найден: ${searchResult.title}`);
    console.log(`⬇️ Скачивание...`);

    // 2. Скачиваем
    const downloadResult = await downloadAudio(searchResult.url);
    
    if (!downloadResult.success) {
      return downloadResult;
    }

    console.log(`✅ Скачано: ${(downloadResult.buffer.length / 1024 / 1024).toFixed(2)} MB`);

    return {
      success: true,
      buffer: downloadResult.buffer,
      videoInfo: {
        videoId: searchResult.videoId,
        url: searchResult.url,
        title: searchResult.title,
        duration: downloadResult.duration,
        author: downloadResult.author,
        thumbnail: searchResult.thumbnail
      }
    };
  } catch (error) {
    console.error('❌ Ошибка searchAndDownload:', error.message);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------
// Экспорт
// ---------------------------------------------

module.exports = {
  searchYouTube,
  downloadAudio,
  searchAndDownload
};
