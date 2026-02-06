const musicService = require('../services/musicService');

const handleSearchCommand = async (ctx) => {
  try {
    const query = ctx.message.text.replace('/search', '').trim();
    
    if (!query) {
      return ctx.reply('Please provide a search query. Example: /search Imagine Dragons');
    }

    const statusMsg = await ctx.reply(`Ищу "запрос: ${query}"...`);
    
    const results = await musicService.searchMusic(query, 5);
    
    if (results.length === 0) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `Не найдено результатов для "запрос: ${query}"`
      );
      return;
    }

    let message = `Результаты поиска для "${query}":\n\n`;
    results.forEach((result, index) => {
      message += `${index + 1}. ${result.title}\n`;
      message += `   Автор: ${result.author}\n`;
      message += `   Длительность: ${result.duration}\n`;
      message += `   URL: ${result.url}\n\n`;
    });
    
    message += 'Используйте /download <URL> для скачивания';

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      message
    );
  } catch (error) {
    console.error('Search command error:', error);
    ctx.reply('Ошибка при поиске музыки. Попробуйте позже.');
  }
};

const handleDownloadCommand = async (ctx) => {
  try {
    const url = ctx.message.text.replace('/download', '').trim();
    
    if (!url) {
      return ctx.reply('Please provide a YouTube URL. Example: /download https://youtube.com/watch?v=...');
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return ctx.reply('Пожалуйста, укажите YouTube URL.');
    }

    const statusMsg = await ctx.reply('Загрузка музыки...');
    
    // Get video info first
    const info = await musicService.getVideoInfo(url);
    const filename = `${Date.now()}_${info.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
    
    // Download the music
    const filePath = await musicService.downloadMusic(url, filename);
    
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      'Отправка файла...'
    );
    
    // Send the audio file
    await ctx.replyWithAudio({
      source: filePath,
      filename: `${info.title}.mp3`
    }, {
      title: info.title,
      performer: info.author
    });
    
    // Cleanup the file after sending
    musicService.cleanupFile(filePath);
    
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
  } catch (error) {
    console.error('Download command error:', error);
    ctx.reply('Ошибка при скачивании музыки. Пожалуйста, проверьте URL и попробуйте снова.');
  }
};

module.exports = {
  handleSearchCommand,
  handleDownloadCommand
};
