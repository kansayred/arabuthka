const { searchYouTube, downloadAudio } = require('../services/youtubeDownloader');
const fs = require('fs').promises;
const path = require('path');

// --------------------------------------------
// Обработчик команды /download
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

    // Ищем трек на YouTube
    const searchResults = await searchYouTube(query);

    if (!searchResults || searchResults.length === 0) {
      await bot.editMessageText(
        `❌ Ничего не найдено по запросу: "${query}"`,
        { chat_id: chatId, message_id: searchMsg.message_id }
      );
      return;
    }

    const firstResult = searchResults[0];
    
    // Уведомляем о начале скачивания
    await bot.editMessageText(
      `✅ Найдено: ${firstResult.title}\n📥 Скачиваю аудио...`,
      { chat_id: chatId, message_id: searchMsg.message_id }
    );

    // Скачиваем аудио
    const downloadResult = await downloadAudio(firstResult.url);

    if (!downloadResult.success) {
      await bot.editMessageText(
        `❌ Ошибка при скачивании: ${downloadResult.error?.message || 'Неизвестная ошибка'}`,
        { chat_id: chatId, message_id: searchMsg.message_id }
      );
      return;
    }

    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, searchMsg.message_id);

    // Отправляем аудио файл пользователю
    await bot.sendAudio(chatId, downloadResult.buffer, {
      title: downloadResult.videoInfo.title,
      performer: downloadResult.videoInfo.author,
      duration: downloadResult.videoInfo.duration,
      thumb: downloadResult.videoInfo.thumbnail
    }, {
      caption: `🎵 ${downloadResult.videoInfo.title}\n👤 ${downloadResult.videoInfo.author}`
    });

    console.log(`✅ Трек успешно отправлен: ${downloadResult.videoInfo.title}`);

  } catch (error) {
    console.error('❌ Ошибка в handleDownload:', error);
    await bot.sendMessage(
      chatId,
      `❌ Произошла ошибка при обработке запроса. Попробуйте позже.`
    );
  }
}

module.exports = { handleDownload };
