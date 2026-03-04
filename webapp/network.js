/**
 * Network — Offline handling, retry, skeleton loaders
 * Экспорт: window.Network
 */
(function() {
  'use strict';

  var MAX_RETRIES = 3;
  var INITIAL_DELAY = 1000; // 1s → 2s → 4s

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg, 3000);
  }

  // === Retry с exponential backoff ===
  async function retry(fn, retries, delay) {
    retries = retries || MAX_RETRIES;
    delay = delay || INITIAL_DELAY;

    for (var attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await new Promise(function(r) { setTimeout(r, delay); });
        delay *= 2; // exponential backoff
      }
    }
  }

  // === Fetch с retry ===
  async function fetchWithRetry(url, options) {
    return retry(function() {
      return fetch(url, options).then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res;
      });
    });
  }

  // === Online/Offline detection ===
  var wasOffline = false;

  function handleOnline() {
    if (wasOffline) {
      toast('\u2705 \u0421\u0435\u0442\u044c \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430');
      wasOffline = false;
    }
  }

  function handleOffline() {
    wasOffline = true;
    toast('\u26a0\ufe0f \u041d\u0435\u0442 \u0441\u0435\u0442\u0438');
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Проверка при загрузке
  if (!navigator.onLine) {
    handleOffline();
  }

  // === Skeleton helpers ===
  function showSkeletonList(container, count) {
    count = count || 5;
    var html = '';
    for (var i = 0; i < count; i++) {
      html +=
        '<div class="skeleton-card">' +
        '<div class="skeleton" style="width:26px;height:26px;border-radius:50%;"></div>' +
        '<div style="flex:1;">' +
        '<div class="skeleton skeleton-text" style="width:' + (50 + Math.random() * 30) + '%;height:14px;margin-bottom:6px;"></div>' +
        '<div class="skeleton skeleton-text" style="width:' + (30 + Math.random() * 20) + '%;height:12px;"></div>' +
        '</div></div>';
    }
    if (container) container.innerHTML = html;
    return html;
  }

  // Экспорт
  window.Network = {
    retry: retry,
    fetchWithRetry: fetchWithRetry,
    showSkeletonList: showSkeletonList,
    isOnline: function() { return navigator.onLine; }
  };
})();
