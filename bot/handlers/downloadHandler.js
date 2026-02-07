// downloadHandler.js
// Обработчик команды /download с поддержкой Cobalt API

const { searchAndDownload } = require('../services/cobaltDownloader');
const { searchYouTube, downloadAudio } = require('../services/youtubeDownloader');

// --------------------------------------------
// Обработчик команды /download
// Использует Cobalt API с fallback на youtubeDownloader
// --------------------------------------------
async function handleDownload(bot, msg) {
  const chatId = msg.chat.id;
  const query = msg.text.replace('/download', '').trim();

  if (!query) {
    await bot.sendMessage(chatId, '❌ Укажите название трека для скачивания.\n\nПример: /download Моргенштерн - Cadillac');
    return;
  }

  try {
    // Уведомляем пользователя о начале поиска
    const searchMsg = await bot.sendMessage(chatId, `🔍 Ищу трек: "${query}"...`);

    // Пытаемся скачать через Cobalt API (основной метод)
    let downloadResult = await searchAndDownload(query);

    // Если Cobalt не сработал, пробуем fallback
    if (!downloadResult.success) {
      console.log(`⚠️ Cobalt не сработал, пробуем youtubeDownloader: ${downloadResult.error}`);
      
      await bot.editMessageText(
        `🔄 Переключаюсь на альтернативный метод...`,
        { chat_id: chatId, message_id: searchMsg.message_id }
      );

      downloadResult = await fallbackDownload(query);
    }

    if (!downloadResult.success) {
      await bot.editMessageText(
        `❌ Не удалось скачать трек: ${downloadResult.error || 'Неизвестная ошибка'}`,
        { chat_id: chatId, message_id: searchMsg.message_id }
      );
      return;
    }

    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, searchMsg.message_id);

    // Отправляем аудио файл пользователю
    const track = downloadResult.track;
    await bot.sendAudio(chatId, downloadResult.buffer, {
      title: track.title,
      performer: track.artist,
      duration: track.durationSeconds || track.duration
    }, {
      caption: `🎵 ${track.title}\n👤 ${track.artist}`
    });

    console.log(`✅ Трек успешно отправлен: ${track.title}`);

  } catch (error) {
    console.error('❌ Ошибка в handleDownload:', error);
    await bot.sendMessage(
      chatId,
      `❌ Произошла ошибка при обработке запроса. Попробуйте позже.`
    );
  }
}

// --------------------------------------------
// Fallback метод через youtubeDownloader
// --------------------------------------------
async function fallbackDownload(query) {
  try {
    const searchResults = await searchYouTube(query);
    
    if (!searchResults || searchResults.length === 0) {
      return { success: false, error: 'Трек не найден' };
    }

    const firstResult = searchResults[0];
    const downloadResult = await downloadAudio(firstResult.url);

    if (!downloadResult.success) {
      return { success: false, error: downloadResult.error?.message || 'Ошибка скачивания' };
    }

    return {
      success: true,
      buffer: downloadResult.buffer,
      track: {
        title: downloadResult.videoInfo.title,
        artist: downloadResult.videoInfo.author,
        duration: downloadResult.videoInfo.duration
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { handleDownload };
