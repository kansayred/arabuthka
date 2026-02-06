const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const stream = require('stream');

/**
 * Обработчик команды /download
 * Скачивает музыку с YouTube по запросу пользователя
 */
async function handleDownload(bot, msg) {
  const chatId = msg.chat.id;
  const query = msg.text.replace('/download', '').replace('/music', '').trim();

  if (!query) {
    await bot.sendMessage(
      chatId,
      '❌ Укажите название трека для скачивания.\n\n' +
      'Пример:\n' +
      '/download Моргенштерн - Cadillac\n' +
      '/music Miyagi - Kosandra'
    );
    return;
  }

  let statusMsg;

  try {
    // Уведомляем пользователя о начале поиска
    statusMsg = await bot.sendMessage(chatId, `🔍 Ищу: "${query}"...`);

    // Поиск на YouTube
    const searchResults = await ytsr(query, { limit: 3 });
    const videos = searchResults.items.filter(item => item.type === 'video');

    if (!videos || videos.length === 0) {
      await bot.editMessageText(
        `❌ Ничего не найдено по запросу: "${query}"`,
        { chat_id: chatId, message_id: statusMsg.message_id }
      );
      return;
    }

    const video = videos[0];
    
    // Обновляем статус
    await bot.editMessageText(
      `✅ Найдено: ${video.title}\n\n📥 Скачиваю аудио...\n\n⏳ Это может занять некоторое время`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    );

    // Проверяем, что видео доступно для скачивания
    const info = await ytdl.getInfo(video.url);
    
    // Выбираем лучший аудио формат
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    if (!audioFormat) {
      throw new Error('Не удалось найти подходящий аудио формат');
    }

    // Скачиваем аудио в буфер
    const chunks = [];
    const audioStream = ytdl(video.url, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    audioStream.on('data', (chunk) => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);

    // Удаляем сообщение о статусе
    await bot.deleteMessage(chatId, statusMsg.message_id);

    // Отправляем аудио файл пользователю
    await bot.sendAudio(chatId, buffer, {
      title: info.videoDetails.title,
      performer: info.videoDetails.author.name,
      duration: parseInt(info.videoDetails.lengthSeconds),
    }, {
      caption: `🎵 ${info.videoDetails.title}\n👤 ${info.videoDetails.author.name}`
    });

    console.log(`✅ Трек успешно отправлен пользователю ${chatId}: ${info.videoDetails.title}`);

  } catch (error) {
    console.error('❌ Ошибка в handleDownload:', error);
    
    // Пытаемся удалить сообщение о статусе, если оно существует
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (e) {
        // Игнорируем ошибку удаления
      }
    }

    await bot.sendMessage(
      chatId,
      `❌ Произошла ошибка при обработке запроса.\n\n` +
      `Возможные причины:\n` +
      `• Видео недоступно в вашем регионе\n` +
      `• Видео защищено от скачивания\n` +
      `• Временные проблемы с YouTube\n\n` +
      `Попробуйте другой запрос или повторите позже.`
    );
  }
}

/**
 * Обработчик команды /search
 * Показывает результаты поиска с кнопками для скачивания
 */
async function handleSearch(bot, msg) {
  const chatId = msg.chat.id;
  const query = msg.text.replace('/search', '').trim();

  if (!query) {
    await bot.sendMessage(
      chatId,
      '❌ Укажите название трека для поиска.\n\n' +
      'Пример: /search Miyagi Kosandra'
    );
    return;
  }

  try {
    const statusMsg = await bot.sendMessage(chatId, `🔍 Ищу: "${query}"...`);

    // Поиск на YouTube
    const searchResults = await ytsr(query, { limit: 5 });
    const videos = searchResults.items.filter(item => item.type === 'video');

    if (!videos || videos.length === 0) {
      await bot.editMessageText(
        `❌ Ничего не найдено по запросу: "${query}"`,
        { chat_id: chatId, message_id: statusMsg.message_id }
      );
      return;
    }

    // Удаляем сообщение о поиске
    await bot.deleteMessage(chatId, statusMsg.message_id);

    // Формируем список результатов
    let resultText = `🔍 Результаты поиска: "${query}"\n\n`;
    const keyboard = [];

    videos.slice(0, 5).forEach((video, index) => {
      const duration = video.duration || 'N/A';
      resultText += `${index + 1}. ${video.title}\n`;
      resultText += `   👤 ${video.author?.name || 'Unknown'}\n`;
      resultText += `   ⏱ ${duration}\n\n`;

      keyboard.push([{
        text: `⬇️ Скачать #${index + 1}`,
        callback_data: `download_${video.id}`
      }]);
    });

    await bot.sendMessage(chatId, resultText, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('❌ Ошибка в handleSearch:', error);
    await bot.sendMessage(
      chatId,
      '❌ Произошла ошибка при поиске. Попробуйте позже.'
    );
  }
}

/**
 * Обработчик callback-запросов для кнопок скачивания
 */
async function handleDownloadCallback(bot, query) {
  const chatId = query.message.chat.id;
  const videoId = query.data.replace('download_', '');

  try {
    await bot.answerCallbackQuery(query.id, {
      text: '📥 Начинаю скачивание...'
    });

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getInfo(videoUrl);

    const statusMsg = await bot.sendMessage(
      chatId,
      `📥 Скачиваю: ${info.videoDetails.title}...`
    );

    // Скачиваем аудио
    const chunks = [];
    const audioStream = ytdl(videoUrl, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    audioStream.on('data', (chunk) => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);

    await bot.deleteMessage(chatId, statusMsg.message_id);

    await bot.sendAudio(chatId, buffer, {
      title: info.videoDetails.title,
      performer: info.videoDetails.author.name,
      duration: parseInt(info.videoDetails.lengthSeconds),
    }, {
      caption: `🎵 ${info.videoDetails.title}\n👤 ${info.videoDetails.author.name}`
    });

  } catch (error) {
    console.error('❌ Ошибка в handleDownloadCallback:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Ошибка при скачивании',
      show_alert: true
    });
  }
}

module.exports = {
  handleDownload,
  handleSearch,
  handleDownloadCallback
};
