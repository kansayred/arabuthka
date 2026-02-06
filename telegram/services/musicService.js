const ytsr = require('ytsr');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

class MusicService {
  constructor() {
    this.downloadDir = path.join(__dirname, '../downloads');
    this.ensureDownloadDir();
  }

  ensureDownloadDir() {
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async searchMusic(query, limit = 5) {
    try {
      const searchResults = await ytsr(query, { limit });
      
      return searchResults.items
        .filter(item => item.type === 'video')
        .map(video => ({
          title: video.title,
          url: video.url,
          duration: video.duration,
          author: video.author?.name || 'Unknown',
          thumbnail: video.thumbnails?.[0]?.url
        }));
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Failed to search for music');
    }
  }

  async downloadMusic(url, filename) {
    try {
      const filePath = path.join(this.downloadDir, filename);
      
      return new Promise((resolve, reject) => {
        const stream = ytdl(url, {
          filter: 'audioonly',
          quality: 'highestaudio'
        });

        const writeStream = fs.createWriteStream(filePath);
        
        stream.pipe(writeStream);

        writeStream.on('finish', () => {
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          reject(error);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error('Download error:', error);
      throw new Error('Failed to download music');
    }
  }

  async getVideoInfo(url) {
    try {
      const info = await ytdl.getInfo(url);
      return {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author.name,
        thumbnail: info.videoDetails.thumbnails?.[0]?.url
      };
    } catch (error) {
      console.error('Video info error:', error);
      throw new Error('Failed to get video information');
    }
  }

  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = new MusicService();
