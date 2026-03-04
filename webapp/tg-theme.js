/**
 * tg-theme.js — Telegram ThemeParams → CSS custom properties
 * Reads Telegram.WebApp.themeParams and maps them to the app's design tokens.
 * Listens for themeChanged event for dynamic dark/light mode switching.
 */
(function() {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;

  /**
   * Map Telegram themeParams to app CSS variables.
   * TG provides: bg_color, text_color, hint_color, link_color,
   * button_color, button_text_color, secondary_bg_color,
   * header_bg_color, accent_text_color, section_bg_color,
   * section_header_text_color, subtitle_text_color,
   * destructive_text_color
   */
  function applyTheme() {
    var tp = tg.themeParams || {};
    var root = document.documentElement;

    // Helper: set CSS var only if TG provides it
    function set(prop, val) {
      if (val) root.style.setProperty(prop, val);
    }

    // Telegram → Arabuthka CSS mapping
    // Background
    set('--tg-theme-bg-color', tp.bg_color);
    set('--tg-theme-secondary-bg-color', tp.secondary_bg_color);
    set('--tg-theme-text-color', tp.text_color);
    set('--tg-theme-hint-color', tp.hint_color);
    set('--tg-theme-link-color', tp.link_color);
    set('--tg-theme-button-color', tp.button_color);
    set('--tg-theme-button-text-color', tp.button_text_color);

    // Map to app design tokens
    set('--bg-primary', tp.bg_color);
    set('--bg-card', tp.bg_color);
    set('--bg-secondary', tp.secondary_bg_color);
    set('--bg-elevated', tp.bg_color);
    set('--bg-card-hover', tp.secondary_bg_color);

    // Text colors
    set('--text-primary', tp.text_color);
    set('--text-secondary', tp.hint_color || tp.subtitle_text_color);
    set('--text-muted', tp.hint_color);

    // Accent — use accent_text_color (TG 7.x+), fallback link_color
    var accent = tp.accent_text_color || tp.link_color || tp.button_color;
    if (accent) {
      set('--accent', accent);
      set('--ara-accent', accent);
      set('--ara-gradient-start', accent);
      // Derive accent-glow from accent
      root.style.setProperty('--accent-glow', accent + '2e');
      root.style.setProperty('--border-accent', accent + '40');
      root.style.setProperty('--shadow-neon',
        '0 4px 20px ' + accent + '26');
      root.style.setProperty('--shadow-neon-strong',
        '0 6px 30px ' + accent + '40');
    }

    // Destructive color for delete actions
    if (tp.destructive_text_color) {
      set('--accent-secondary', tp.destructive_text_color);
    }

    // Border — derive from text with low alpha
    if (tp.text_color) {
      root.style.setProperty('--border',
        tp.text_color + '0f');
    }

    // Detect dark mode from background luminance
    if (tp.bg_color) {
      var isDark = isColorDark(tp.bg_color);
      document.body.classList.toggle('tg-dark', isDark);

      if (isDark) {
        // Dark mode overrides for gradients
        root.style.setProperty('--gradient-bg',
          'linear-gradient(180deg, ' +
          (tp.bg_color || '#1a1a2e') + ' 0%, ' +
          (tp.secondary_bg_color || '#1e1b3a') + ' 100%)');
        // Softer shadows in dark mode
        root.style.setProperty('--shadow-soft',
          '0 2px 12px rgba(0, 0, 0, 0.2)');
        root.style.setProperty('--shadow-card',
          '0 4px 20px rgba(0, 0, 0, 0.25)');
        // Bottom nav glass
        root.style.setProperty('--ara-surface-elevated',
          (tp.bg_color || 'rgba(26, 26, 46, 0.88)'));
      }
    }

    // Force Lucide icon recolor for inline SVGs
    // (Lucide uses currentColor, which inherits from text-primary)
  }

  /**
   * Check if a hex color is dark (luminance < 0.5)
   */
  function isColorDark(hex) {
    if (!hex || hex.charAt(0) !== '#') return false;
    var c = hex.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    var r = parseInt(c.substring(0, 2), 16) / 255;
    var g = parseInt(c.substring(2, 4), 16) / 255;
    var b = parseInt(c.substring(4, 6), 16) / 255;
    // Relative luminance
    var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum < 0.5;
  }

  // Apply on load
  applyTheme();

  // Listen for dynamic theme changes (user switches dark/light in TG)
  tg.onEvent('themeChanged', applyTheme);

  // Export for debugging
  window.TgTheme = { apply: applyTheme };
})();