/**
 * i18n.js — Multilingual support for Arabuthka
 * Supports: Russian (ru), English (en)
 * Detects language from Telegram user settings or browser locale
 * Usage: window.I18n.t('key') or data-i18n="key" attributes
 */
(function() {
  'use strict';

  var translations = {
    ru: {
      // App
      'app.name': '\u0410\u0440\u0430\u0431\u0443\u0442\u043a\u0430',
      'app.open_telegram': '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 Telegram',
      // Navigation
      'nav.home': '\u0413\u043b\u0430\u0432\u043d\u0430\u044f',
      'nav.library': '\u0411\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430',
      'nav.search': '\u041f\u043e\u0438\u0441\u043a',
      'nav.profile': '\u041f\u0440\u043e\u0444\u0438\u043b\u044c',
      // Player
      'player.unknown_artist': '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c',
      'player.no_track': '\u041d\u0435\u0442 \u0442\u0440\u0435\u043a\u0430',
      'player.error': '\u041e\u0448\u0438\u0431\u043a\u0430',
      'player.loading': '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
      // Upload
      'upload.button': '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u0440\u0435\u043a',
      'upload.uploading': '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
      'upload.success': '\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e!',
      'upload.error': '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438',
      // Search
      'search.placeholder': '\u041d\u0430\u0439\u0442\u0438 \u0442\u0440\u0435\u043a...',
      'search.global_placeholder': '\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c \u0438\u043b\u0438 \u0442\u0440\u0435\u043a...',
      'search.global_title': '\u041f\u043e\u0438\u0441\u043a \u043c\u0443\u0437\u044b\u043a\u0438',
      'search.hint': '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0437\u0430\u043f\u0440\u043e\u0441 \u0434\u043b\u044f \u043f\u043e\u0438\u0441\u043a\u0430',
      // Sort
      'sort.by_name': '\u041f\u043e \u0438\u043c\u0435\u043d\u0438',
      'sort.by_date': '\u041f\u043e \u0434\u0430\u0442\u0435',
      // Playlist
      'playlist.new': '\u041d\u043e\u0432\u044b\u0439 \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442',
      'playlist.name_placeholder': '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435...',
      'playlist.create': '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',
      'playlist.cancel': '\u041e\u0442\u043c\u0435\u043d\u0430',
      'playlist.add_tracks': '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u0440\u0435\u043a\u0438',
      'playlist.add': '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c',
      // Profile
      'profile.tracks': '\u0442\u0440\u0435\u043a\u043e\u0432',
      'profile.playlists': '\u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u043e\u0432',
      // Queue
      'queue.added': '\u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d',
      'queue.next': '\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439',
      'queue.cleared': '\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u043e\u0447\u0438\u0449\u0435\u043d\u0430',
      // Confirm
      'confirm.delete_track': '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u0442\u0440\u0435\u043a?',
      // Recently played
      'recent.title': '\u041d\u0435\u0434\u0430\u0432\u043d\u043e \u0438\u0433\u0440\u0430\u043b\u0438',
      // Onboarding
      'onboarding.welcome': '\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 \u0410\u0440\u0430\u0431\u0443\u0442\u043a\u0443!',
      'onboarding.skip': '\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c',
      'onboarding.next': '\u0414\u0430\u043b\u0435\u0435',
      // Settings
      'settings.language': '\u042f\u0437\u044b\u043a',
      'settings.title': '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
      'settings.standardize': '\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u0438\u0437\u0430\u0446\u0438\u044f \u0442\u0440\u0435\u043a\u043e\u0432',
      'settings.standardize_hint': '\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u0435\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u044f \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0439 \u0438 \u0430\u0432\u0442\u043e\u0440\u0441\u0442\u0432\u0430',
      'settings.standardize_toast': '\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043e'
    },
    en: {
      'app.name': 'Arabuthka',
      'app.open_telegram': 'Open via Telegram',
      'nav.home': 'Home',
      'nav.library': 'Library',
      'nav.search': 'Search',
      'nav.profile': 'Profile',
      'player.unknown_artist': 'Unknown artist',
      'player.no_track': 'No track',
      'player.error': 'Error',
      'player.loading': 'Loading...',
      'upload.button': 'Upload track',
      'upload.uploading': 'Uploading...',
      'upload.success': 'Uploaded!',
      'upload.error': 'Upload error',
      'search.placeholder': 'Find track...',
      'search.global_placeholder': 'Artist or track...',
      'search.global_title': 'Search music',
      'search.hint': 'Enter a search query',
      'sort.by_name': 'By name',
      'sort.by_date': 'By date',
      'playlist.new': 'New playlist',
      'playlist.name_placeholder': 'Name...',
      'playlist.create': 'Create',
      'playlist.cancel': 'Cancel',
      'playlist.add_tracks': 'Add tracks',
      'playlist.add': 'Add',
      'profile.tracks': 'tracks',
      'profile.playlists': 'playlists',
      'queue.added': 'added',
      'queue.next': 'next',
      'queue.cleared': 'Queue cleared',
      'confirm.delete_track': 'Delete this track?',
      'recent.title': 'Recently played',
      'onboarding.welcome': 'Welcome to Arabuthka!',
      'onboarding.skip': 'Skip',
      'onboarding.next': 'Next',
      'settings.language': 'Language',
      'settings.title': 'Settings',
      'settings.standardize': 'Track standardization',
      'settings.standardize_hint': 'Automatically applies naming and authorship rules',
      'settings.standardize_toast': 'Standardized'
    }
  };

  var currentLang = 'ru';

  function detectLanguage() {
    // 1. Check localStorage preference
    var saved = localStorage.getItem('arabuthka_lang');
    if (saved && translations[saved]) return saved;
    // 2. Check Telegram user language
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      var tgLang = tg.initDataUnsafe.user.language_code;
      if (tgLang && tgLang.startsWith('en')) return 'en';
      if (tgLang && tgLang.startsWith('ru')) return 'ru';
    }
    // 3. Check browser locale
    var nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('en')) return 'en';
    // Default: Russian
    return 'ru';
  }

  function t(key, params) {
    var str = (translations[currentLang] && translations[currentLang][key])
      || (translations.ru && translations.ru[key])
      || key;
    if (params) {
      Object.keys(params).forEach(function(k) {
        str = str.replace('{' + k + '}', params[k]);
      });
    }
    return str;
  }

  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('arabuthka_lang', lang);
    applyToDOM();
    document.documentElement.setAttribute('lang', lang);
  }

  function getLanguage() {
    return currentLang;
  }

  function getAvailableLanguages() {
    return Object.keys(translations);
  }

  function applyToDOM() {
    var els = document.querySelectorAll('[data-i18n]');
    els.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    var ariaEls = document.querySelectorAll('[data-i18n-aria]');
    ariaEls.forEach(function(el) {
      var key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
  }

  // Init
  currentLang = detectLanguage();
  document.documentElement.setAttribute('lang', currentLang);

  // Apply after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyToDOM);
  } else {
    applyToDOM();
  }

  window.I18n = {
    t: t,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    getAvailableLanguages: getAvailableLanguages,
    apply: applyToDOM
  };
})();