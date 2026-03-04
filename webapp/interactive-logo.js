/**
 * interactive-logo.js - Theme-aware interactive logo for Arabuthka
 * Switches logo appearance based on Telegram light/dark theme
 * Reacts to themeChanged events dynamically
 */
(function() {
  'use strict';

  // SVG logo variants as inline markup
  var logos = {
    dark: {
      // Dark theme: gradient peach-to-lavender text, subtle glow
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="logoGradDark" x1="0" y1="0" x2="24" y2="24">' +
        '<stop offset="0%" stop-color="#E8A87C"/>' +
        '<stop offset="100%" stop-color="#D4A5E5"/>' +
        '</linearGradient></defs>' +
        '<path d="M9 18V5l12-2v13" stroke="url(#logoGradDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '<circle cx="6" cy="18" r="3" fill="url(#logoGradDark)" opacity="0.9"/>' +
        '<circle cx="18" cy="16" r="3" fill="url(#logoGradDark)" opacity="0.9"/>' +
        '</svg>',
      textGradient: 'linear-gradient(135deg, #E8A87C, #D4A5E5)',
      glowColor: 'rgba(232, 168, 124, 0.3)'
    },
    light: {
      // Light theme: solid dark icon, clean text
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="logoGradLight" x1="0" y1="0" x2="24" y2="24">' +
        '<stop offset="0%" stop-color="#6B3FA0"/>' +
        '<stop offset="100%" stop-color="#E8A87C"/>' +
        '</linearGradient></defs>' +
        '<path d="M9 18V5l12-2v13" stroke="url(#logoGradLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '<circle cx="6" cy="18" r="3" fill="url(#logoGradLight)"/>' +
        '<circle cx="18" cy="16" r="3" fill="url(#logoGradLight)"/>' +
        '</svg>',
      textGradient: 'linear-gradient(135deg, #6B3FA0, #E8A87C)',
      glowColor: 'rgba(107, 63, 160, 0.15)'
    }
  };

  function getThemeMode() {
    // Check body class set by tg-theme.js
    if (document.body.classList.contains('tg-dark')) return 'dark';
    // Check Telegram colorScheme
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.colorScheme === 'dark') return 'dark';
    // Check prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function applyLogo() {
    var mode = getThemeMode();
    var logo = logos[mode];
    var logoEl = document.querySelector('.logo');
    if (!logoEl) return;

    // Replace Lucide icon with custom SVG
    var iconEl = logoEl.querySelector('.logo-icon-svg');
    if (iconEl) {
      // Wrap SVG in a span to replace the <i> element
      var wrapper = document.createElement('span');
      wrapper.className = 'logo-icon-svg';
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.innerHTML = logo.icon;
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.marginRight = '8px';
      wrapper.style.filter = 'drop-shadow(0 0 8px ' + logo.glowColor + ')';
      wrapper.style.transition = 'filter 0.3s ease';
      iconEl.parentNode.replaceChild(wrapper, iconEl);
    }

    // Apply gradient to text
    logoEl.style.backgroundImage = logo.textGradient;
    logoEl.style.webkitBackgroundClip = 'text';
    logoEl.style.backgroundClip = 'text';
    logoEl.style.webkitTextFillColor = 'transparent';
    logoEl.style.transition = 'all 0.3s ease';
  }

  // Apply on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLogo);
  } else {
    // Small delay to let tg-theme.js set body class first
    setTimeout(applyLogo, 50);
  }

  // Listen for Telegram theme changes
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.onEvent('themeChanged', function() {
      setTimeout(applyLogo, 100);
    });
  }

  // Listen for prefers-color-scheme changes (PWA mode)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      setTimeout(applyLogo, 100);
    });
  }

  window.InteractiveLogo = { apply: applyLogo };
})();
