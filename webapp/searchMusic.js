/**
 * SearchMusic — Модуль поиска треков
 * Debounce 400ms, skeleton loader, пустое состояние, play/add-to-queue
 */
(function initSearchModule() {
  'use strict';

  const API_URL = (window.Config && window.Config.api && window.Config.api.baseUrl)
    || 'https://arabuthka-production.up.railway.app';
  const DEBOUNCE_MS = 400;
  const MIN_QUERY_LENGTH = 2;

  const searchInput = document.getElementById('globalSearchInput');
  const searchBtn = document.getElementById('globalSearchBtn');
  const resultsContainer = document.getElementById('globalSearchResults');
  if (!searchInput || !searchBtn || !resultsContainer) return;

  let debounceTimer = null;
  let searchResults = [];

  // Получение auth-заголовков
  function getAuthHeaders() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) {
      return { 'X-Telegram-Init-Data': tg.initData };
    }
    return {};
  }

  // HTML-экранирование
  function esc(text) {
    const d = document.createElement('div');
    d.textContent = text || '';
    return d.innerHTML;
  }

  // Безопасный cover URL
  function safeCover(url) {
    if (!url) return '';
    try {
      const p = new URL(url);
      if (p.protocol === 'https:' || p.protocol === 'data:') return url;
    } catch (e) { /* игнор */ }
    return '';
  }

  // Skeleton loader
  function showSkeleton() {
    const items = Array.from({ length: 4 }, () =>
      '<div class="skeleton-card" style="display:flex;gap:12px;padding:12px;margin-bottom:8px;">'
      + '<div class="skeleton" style="width:46px;height:46px;border-radius:8px;flex-shrink:0;"></div>'
      + '<div style="flex:1;">'
      + '<div class="skeleton skeleton-text" style="width:70%;height:14px;margin-bottom:6px;"></div>'
      + '<div class="skeleton skeleton-text" style="width:45%;height:12px;"></div>'
      + '</div></div>'
    ).join('');
    resultsContainer.innerHTML = items;
  }

  // Пустое состояние
  function showEmpty(query) {
    resultsContainer.innerHTML = query
      ? '<div class="empty-state">' + esc('🔍 Ничего не найдено по запросу \u00ab' + query + '\u00bb') + '</div>'
      : '<p>Введите запрос для поиска</p>';
  }

  // Основной поиск
  async function performSearch(query) {
    query = (query || '').trim();
    if (query.length < MIN_QUERY_LENGTH) {
      showEmpty('');
      searchResults = [];
      return;
    }

    showSkeleton();

    try {
      const res = await fetch(
        API_URL + '/api/search/all?q=' + encodeURIComponent(query),
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const results = data.results || data.tracks || data || [];

      if (!Array.isArray(results) || results.length === 0) {
        searchResults = [];
        showEmpty(query);
        return;
      }

      searchResults = results;
      renderResults(results);
    } catch (err) {
      resultsContainer.innerHTML =
        '<div class="empty-state">❌ Ошибка поиска: '
        + esc(err.message) + '</div>';
    }
  }

  // Рендер результатов
  function renderResults(results) {
    resultsContainer.innerHTML = results.map(function(track, i) {
      var title = esc(track.name || track.title || 'Без названия');
      var artist = esc(track.artist || 'Неизвестный');
      var coverUrl = safeCover(track.cover || track.cover_url);
      var coverHtml = coverUrl
        ? '<img class="search-result-cover" src="' + esc(coverUrl) + '" alt="" loading="lazy">'
        : '<div class="search-result-cover no-cover"></div>';

      return '<div class="search-result-item" role="listitem">'
        + coverHtml
        + '<div class="search-result-info">'
        + '<div class="search-result-title">' + title + '</div>'
        + '<div class="search-result-artist">' + artist + '</div>'
        + '</div>'
        + '<button class="btn-icon search-play-btn" '
        + 'onclick="window._searchPlay(' + i + ')" '
        + 'aria-label="Воспроизвести ' + title + '">'
        + '<i data-lucide="play" style="width:16px;height:16px" aria-hidden="true"></i>'
        + '</button>'
        + '<button class="btn-icon search-queue-btn" '
        + 'onclick="window._searchAddQueue(' + i + ')" '
        + 'aria-label="Добавить в очередь ' + title + '">'
        + '<i data-lucide="list-plus" style="width:16px;height:16px" aria-hidden="true"></i>'
        + '</button>'
        + '</div>';
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // Debounce
  function debouncedSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      performSearch(searchInput.value);
    }, DEBOUNCE_MS);
  }

  // События
  searchInput.addEventListener('input', debouncedSearch);
  searchBtn.addEventListener('click', function() {
    clearTimeout(debounceTimer);
    performSearch(searchInput.value);
  });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      performSearch(searchInput.value);
    }
  });

  // Экспорт для кнопок
  window._searchPlay = function(index) {
    var track = searchResults[index];
    if (!track) return;
    if (typeof window.playSearchResult === 'function') {
      window._searchResults = searchResults;
      window.playSearchResult(index);
    }
  };

  window._searchAddQueue = function(index) {
    var track = searchResults[index];
    if (!track) return;
    if (typeof window.addToQueue === 'function') {
      window.addToQueue({
        id: track.id || Date.now(),
        name: track.name || track.title || 'Без названия',
        artist: track.artist || '',
        url: track.url || '',
        cover_url: track.cover || track.cover_url || ''
      });
    }
  };

  window.SearchMusic = { performSearch: performSearch };
})();
