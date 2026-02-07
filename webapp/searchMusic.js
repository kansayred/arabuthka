/**
 * Search Music Module
 * Модуль для поиска и скачивания музыки в Mini App
 */

const API_URL = 'https://arabuthka-production.up.railway.app';

/**
 * Поиск треков (библиотека + внешние источники)
 * @param {string} query - Поисковый запрос
 * @param {string} initData - Telegram InitData для авторизации
 * @param {number} limit - Максимум результатов
 * @returns {Promise<Object>} Результаты поиска
 */
export async function searchTracks(query, initData, limit = 20) {
  try {
    const response = await fetch(
      `${API_URL}/api/search/all?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          'X-Telegram-Init-Data': initData
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка поиска:', error);
    return { success: false, error: error.message, tracks: [] };
  }
}

/**
 * Скачать трек и добавить в библиотеку
 * @param {Object} track - Данные трека
 * @param {string} initData - Telegram InitData
 * @returns {Promise<Object>} Результат скачивания
 */
export async function downloadTrack(track, initData) {
  try {
    const response = await fetch(`${API_URL}/api/search/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData
      },
      body: JSON.stringify({
        previewUrl: track.previewUrl || track.url,
        title: track.title,
        artist: track.artist
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка скачивания:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Класс для управления UI поиска
 */
export class SearchManager {
  constructor(options) {
    this.initData = options.initData;
    this.onTrackSelect = options.onTrackSelect || (() => {});
    this.onDownloadComplete = options.onDownloadComplete || (() => {});
    
    this.searchResults = [];
    this.isSearching = false;
    this.debounceTimer = null;
  }

  /**
   * Выполнить поиск с debounce
   */
  async search(query) {
    clearTimeout(this.debounceTimer);
    
    if (!query || query.trim().length < 2) {
      this.searchResults = [];
      this.renderResults();
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      this.isSearching = true;
      this.renderLoading();

      const result = await searchTracks(query, this.initData);
      
      this.isSearching = false;
      this.searchResults = result.tracks || [];
      this.renderResults();
    }, 300);
  }

  /**
   * Скачать выбранный трек
   */
  async download(track) {
    const btn = document.querySelector(`[data-track-id="${track.id}"] .download-btn`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳';
    }

    const result = await downloadTrack(track, this.initData);
    
    if (result.success) {
      if (btn) {
        btn.textContent = '✅';
        btn.classList.add('downloaded');
      }
      this.onDownloadComplete(result.track);
    } else {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⬇️';
      }
      alert('Ошибка скачивания: ' + (result.error || 'Неизвестная ошибка'));
    }

    return result;
  }

  /**
   * Отрисовка загрузки
   */
  renderLoading() {
    const container = document.getElementById('searchResults');
    if (container) {
      container.innerHTML = '<div class="search-loading">🔍 Ищем...</div>';
    }
  }

  /**
   * Отрисовка результатов
   */
  renderResults() {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (this.searchResults.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.searchResults.map(track => `
      <div class="search-result-item" data-track-id="${track.id || track.title}">
        <div class="search-result-cover ${track.cover ? '' : 'no-cover'}" 
             style="${track.cover ? `background-image: url(${track.cover})` : ''}"></div>
        <div class="search-result-info">
          <div class="search-result-title">${this.escapeHtml(track.title)}</div>
          <div class="search-result-artist">${this.escapeHtml(track.artist || 'Неизвестный')}</div>
          <div class="search-result-source">${track.isDownloaded ? '📚 В библиотеке' : '🌐 ' + (track.source || 'iTunes')}</div>
        </div>
        <div class="search-result-actions">
          ${track.isDownloaded 
            ? `<button class="play-btn" onclick="window.searchManager.playTrack('${track.id}')">\u25b6\ufe0f</button>`
            : `<button class="download-btn" onclick="window.searchManager.download(${JSON.stringify(track).replace(/"/g, '&quot;')})">⬇️</button>`
          }
        </div>
      </div>
    `).join('');
  }

  /**
   * Воспроизвести трек из библиотеки
   */
  playTrack(trackId) {
    this.onTrackSelect(trackId);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
