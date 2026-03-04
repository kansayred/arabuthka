/**
 * MiniPlayer — Sticky mini-player + fullscreen overlay
 * Reads queue from window.getCurrentQueueTrack (app.js export)
 */
(function() {
  'use strict';

  var miniEl = document.getElementById('miniPlayer');
  var fsEl = document.getElementById('fullscreenPlayer');
  if (!miniEl || !fsEl) return;

  var audio = document.getElementById('audioPlayer');
  var miniCover = miniEl.querySelector('.mini-player-cover');
  var miniTitle = miniEl.querySelector('.mini-player-title');
  var miniArtist = miniEl.querySelector('.mini-player-artist');
  var miniPlayBtn = miniEl.querySelector('.mini-player-play');
  var miniProgress = miniEl.querySelector('.mini-player-progress');

  var fsCover = fsEl.querySelector('.fs-cover');
  var fsTitle = fsEl.querySelector('.fs-title');
  var fsArtist = fsEl.querySelector('.fs-artist');
  var fsCloseBar = fsEl.querySelector('.fs-close-bar');

  var isOpen = false;
  var touchStartY = 0, touchDeltaY = 0;

  function haptic(type) {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(type || 'light');
  }

  function safeCover(url) {
    if (!url) return '';
    try { var p = new URL(url); if (p.protocol === 'https:' || p.protocol === 'data:') return url; } catch (e) {}
    return '';
  }

  function updateMiniPlayer() {
    var track = (typeof window.getCurrentQueueTrack === 'function') ? window.getCurrentQueueTrack() : null;
    if (!track) { miniEl.classList.remove('visible'); return; }

    miniEl.classList.add('visible');
    if (miniTitle) miniTitle.textContent = track.name || 'Без названия';
    if (miniArtist) miniArtist.textContent = track.artist || '';

    var coverUrl = safeCover(track.cover_url);
    if (miniCover) {
      miniCover.innerHTML = coverUrl ? '<img src="' + coverUrl + '" alt="">' : '';
      miniCover.classList.toggle('no-cover', !coverUrl);
    }
    if (fsTitle) fsTitle.textContent = track.name || 'Без названия';
    if (fsArtist) fsArtist.textContent = track.artist || '';
    if (fsCover) fsCover.innerHTML = coverUrl ? '<img src="' + coverUrl + '" alt="">' : '';
  }

  function updateProgress() {
    if (!audio || !audio.duration || !miniProgress) return;
    miniProgress.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
  }

  function updatePlayIcon() {
    if (!miniPlayBtn || !window.lucide) return;
    var icon = (audio && !audio.paused) ? 'pause' : 'play';
    miniPlayBtn.innerHTML = '<i data-lucide="' + icon + '" style="width:18px;height:18px" aria-hidden="true"></i>';
    lucide.createIcons({ nodes: [miniPlayBtn] });
  }

  function openFullscreen() {
    isOpen = true; fsEl.classList.add('open'); haptic('medium');
    document.body.style.overflow = 'hidden';
  }

  function closeFullscreen() {
    isOpen = false; fsEl.classList.remove('open'); fsEl.style.transform = ''; haptic('light');
    document.body.style.overflow = '';
  }

  // Click mini-player body → open fullscreen
  miniEl.addEventListener('click', function(e) {
    if (e.target.closest('.mini-player-play')) return;
    openFullscreen();
  });

  // Mini play/pause button
  if (miniPlayBtn) {
    miniPlayBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (typeof window.togglePlay === 'function') window.togglePlay();
    });
  }

  // Click close-bar → close fullscreen
  if (fsCloseBar) {
    fsCloseBar.addEventListener('click', closeFullscreen);
  }

  // Swipe down to close fullscreen
  fsEl.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY; touchDeltaY = 0;
  }, { passive: true });

  fsEl.addEventListener('touchmove', function(e) {
    touchDeltaY = e.touches[0].clientY - touchStartY;
    if (touchDeltaY > 0) fsEl.style.transform = 'translateY(' + touchDeltaY + 'px)';
  }, { passive: true });

  fsEl.addEventListener('touchend', function() {
    if (touchDeltaY > 120) closeFullscreen();
    else fsEl.style.transform = '';
  }, { passive: true });

  // Audio events
  if (audio) {
    audio.addEventListener('play', function() { updateMiniPlayer(); updatePlayIcon(); });
    audio.addEventListener('pause', updatePlayIcon);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', function() { updateMiniPlayer(); updatePlayIcon(); });
  }

  setInterval(updateMiniPlayer, 1000);

  window.MiniPlayer = { update: updateMiniPlayer, open: openFullscreen, close: closeFullscreen };
})();
