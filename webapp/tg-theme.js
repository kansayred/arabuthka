/**
 * tg-theme.js v3 — Telegram ThemeParams → --ara-* токены
 * Читает Telegram.WebApp.themeParams и маппит на дизайн-токены приложения.
 * Слушает themeChanged для динамической смены темы.
 */
(function() {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;

  function applyTheme() {
    var tp = tg.themeParams || {};
    var root = document.documentElement;

    function set(prop, val) {
      if (val) root.style.setProperty(prop, val);
    }

    // === Основные --ara-* токены ===

    // Фоны
    set('--ara-bg', tp.bg_color);
    set('--ara-bg-card', tp.bg_color);
    set('--ara-bg-secondary', tp.secondary_bg_color);
    set('--ara-bg-input', tp.secondary_bg_color);

    // Текст
    set('--ara-text', tp.text_color);
    set('--ara-text-secondary', tp.hint_color || tp.subtitle_text_color);
    set('--ara-text-muted', tp.hint_color);

    // Акцент
    var accent = tp.accent_text_color || tp.link_color || tp.button_color;
    if (accent) {
      set('--ara-accent', accent);
      root.style.setProperty('--ara-accent-glow', accent + '2e');
      root.style.setProperty('--ara-accent-subtle', accent + '0d');
      root.style.setProperty('--ara-accent-hover', accent + 'cc');
    }

    // Кнопки (inverse)
    set('--ara-text-inverse', tp.button_text_color);

    // Границы
    if (tp.text_color) {
      root.style.setProperty('--ara-border', tp.text_color + '12');
      root.style.setProperty('--ara-border-strong', tp.text_color + '20');
      root.style.setProperty('--ara-divider', tp.text_color + '08');
    }

    // Оверлей
    if (tp.bg_color) {
      root.style.setProperty('--ara-overlay', tp.bg_color + 'cc');
    }

    // === Определение тёмной темы ===
    if (tp.bg_color) {
      var isDark = isColorDark(tp.bg_color);
      document.body.classList.toggle('tg-dark', isDark);
    }

    // === Обратная совместимость со старыми токенами ===
    set('--bg-primary', tp.bg_color);
    set('--bg-card', tp.bg_color);
    set('--bg-secondary', tp.secondary_bg_color);
    set('--text-primary', tp.text_color);
    set('--text-secondary', tp.hint_color || tp.subtitle_text_color);
    set('--text-muted', tp.hint_color);
    if (accent) set('--accent', accent);
    if (tp.text_color) set('--border', tp.text_color + '0f');
  }

  function isColorDark(hex) {
    if (!hex || hex.charAt(0) !== '#') return false;
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substring(0, 2), 16) / 255;
    var g = parseInt(c.substring(2, 4), 16) / 255;
    var b = parseInt(c.substring(4, 6), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.5;
  }

  applyTheme();
  tg.onEvent('themeChanged', applyTheme);
  window.TgTheme = { apply: applyTheme };
})();
