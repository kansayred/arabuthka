/**
 * Gradients — Color extraction из обложки + пресеты
 * Canvas API → --ara-gradient-start / --ara-gradient-end
 * Экспорт: window.Gradients
 */
(function() {
  'use strict';

  var presets = {
    default: { start: '#E8A87C', end: '#D4A5E5' },
    warm:    { start: '#E8A87C', end: '#F7C948' },
    cold:    { start: '#7B8CDE', end: '#D4A5E5' },
    neon:    { start: '#06B6D4', end: '#D4A5E5' },
    sunset:  { start: '#E8A87C', end: '#FDE68A' }
  };

  var root = document.documentElement;

  // Применить пресет
  function applyPreset(name) {
    var p = presets[name] || presets.default;
    root.style.setProperty('--ara-gradient-start', p.start);
    root.style.setProperty('--ara-gradient-end', p.end);
  }

  // Применить произвольные цвета
  function applyColors(startColor, endColor) {
    root.style.setProperty('--ara-gradient-start', startColor);
    root.style.setProperty('--ara-gradient-end', endColor);
  }

  // === Color extraction из обложки ===
  function extractFromImage(imgUrl) {
    return new Promise(function(resolve) {
      if (!imgUrl) {
        applyPreset('default');
        resolve(presets.default);
        return;
      }

      var img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = function() {
        try {
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');
          // Работаем с маленьким размером для скорости
          canvas.width = 50;
          canvas.height = 50;
          ctx.drawImage(img, 0, 0, 50, 50);
          var data = ctx.getImageData(0, 0, 50, 50).data;

          // Средний цвет верхней части → start
          var topR = 0, topG = 0, topB = 0, topCount = 0;
          for (var y = 0; y < 15; y++) {
            for (var x = 0; x < 50; x++) {
              var i = (y * 50 + x) * 4;
              topR += data[i];
              topG += data[i + 1];
              topB += data[i + 2];
              topCount++;
            }
          }

          // Средний цвет нижней части → end
          var btmR = 0, btmG = 0, btmB = 0, btmCount = 0;
          for (var y2 = 35; y2 < 50; y2++) {
            for (var x2 = 0; x2 < 50; x2++) {
              var j = (y2 * 50 + x2) * 4;
              btmR += data[j];
              btmG += data[j + 1];
              btmB += data[j + 2];
              btmCount++;
            }
          }

          var startColor = 'rgb(' +
            Math.round(topR / topCount) + ',' +
            Math.round(topG / topCount) + ',' +
            Math.round(topB / topCount) + ')';
          var endColor = 'rgb(' +
            Math.round(btmR / btmCount) + ',' +
            Math.round(btmG / btmCount) + ',' +
            Math.round(btmB / btmCount) + ')';

          applyColors(startColor, endColor);
          resolve({ start: startColor, end: endColor });
        } catch (e) {
          // CORS или другая ошибка — fallback
          applyPreset('default');
          resolve(presets.default);
        }
      };

      img.onerror = function() {
        applyPreset('default');
        resolve(presets.default);
      };

      img.src = imgUrl;
    });
  }

  // Слушаем смену трека
  var audioEl = document.getElementById('audioPlayer');
  if (audioEl) {
    audioEl.addEventListener('loadedmetadata', function() {
      var track = null;
      if (typeof window.getCurrentQueueTrack === 'function') {
        track = window.getCurrentQueueTrack();
      }
      if (track && track.cover_url) {
        extractFromImage(track.cover_url);
      } else {
        applyPreset('default');
      }
    });
  }

  // Экспорт
  window.Gradients = {
    presets: presets,
    applyPreset: applyPreset,
    applyColors: applyColors,
    extractFromImage: extractFromImage
  };
})();
