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

  // Fullscreen control elements
  var fsPlayBtn = document.getElementById('fsPlayBtn');
  var fsPrevBtn = document.getElementById('fsPrevBtn');
  var fsNextBtn = document.getElementById('fsNextBtn');
  var fsShuffleBtn = document.getElementById('fsShuffleBtn');
  var fsRepeatBtn = document.getElementById('fsRepeatBtn');
  var fsProgressBar = document.getElementById('fsProgressBar');
  var fsCurrentTime = document.getElementById('fsCurrentTime');
  var fsDuration = document.getElementById('fsDuration');

  var isOpen = false;
  var touchStartY = 0, touchDeltaY = 0;
  var fsSeeking = false;

  function haptic(type) {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(type || 'light');
  }

  function safeCover(url) {
    if (!url) return '';
    try { var p = new URL(url); if (p.protocol === 'https:' || p.protocol === 'data:') return url; } catch (e) {}
    return '';
  }

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function setIcon(btn, iconName, size) {
    if (!btn || !window.lucide) return;
    btn.innerHTML = '<i data-lucide="' + iconName + '" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true"></i>';
    lucide.createIcons({ nodes: [btn] });
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
    if (!audio || !audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    // Mini-player thin bar
    if (miniProgress) miniProgress.style.width = pct + '%';
    // Fullscreen range + CSS custom prop for track fill
    if (fsProgressBar && !fsSeeking) {
      fsProgressBar.value = pct;
      fsProgressBar.style.setProperty('--fs-progress', pct + '%');
    }
    if (fsCurrentTime) fsCurrentTime.textContent = formatTime(audio.currentTime);
  }

  function updateDuration() {
    if (!audio || !audio.duration) return;
    if (fsDuration) fsDuration.textContent = formatTime(audio.duration);
  }

  function updatePlayIcon() {
    if (!window.lucide) return;
    var isPlaying = audio && !audio.paused;
    // Mini-player
    if (miniPlayBtn) {
      miniPlayBtn.innerHTML = '<i data-lucide="' + (isPlaying ? 'pause' : 'play') + '" style="width:18px;height:18px" aria-hidden="true"></i>';
      lucide.createIcons({ nodes: [miniPlayBtn] });
    }
    // Fullscreen play btn
    if (fsPlayBtn) {
      fsPlayBtn.innerHTML = '<i data-lucide="' + (isPlaying ? 'pause' : 'play') + '" style="width:28px;height:28px" aria-hidden="true"></i>';
      lucide.createIcons({ nodes: [fsPlayBtn] });
    }
  }

  // Sync shuffle/repeat active states from main player buttons
  function syncShuffleRepeatState() {
    var mainShuffle = document.getElementById('shuffleBtn');
    var mainRepeat = document.getElementById('repeatBtn');
    if (fsShuffleBtn && mainShuffle) {
      fsShuffleBtn.classList.toggle('active', mainShuffle.classList.contains('active'));
    }
    if (fsRepeatBtn && mainRepeat) {
      fsRepeatBtn.classList.toggle('active', mainRepeat.classList.contains('active'));
      // Mirror repeat-1 icon if set on main btn
      var mainIcon = mainRepeat.querySelector('[data-lucide]');
      if (mainIcon && fsRepeatBtn) {
        var iconName = mainIcon.getAttribute('data-lucide') || 'repeat';
        setIcon(fsRepeatBtn, iconName, 18);
        // Re-apply active class after setIcon replaces innerHTML
        if (mainRepeat.classList.contains('active')) fsRepeatBtn.classList.add('active');
      }
    }
  }

  function openFullscreen() {
    isOpen = true;
    fsEl.classList.add('open');
    haptic('medium');
    document.body.style.overflow = 'hidden';
    syncShuffleRepeatState();
    updateDuration();
    updateProgress();
  }

  function closeFullscreen() {
    isOpen = false;
    fsEl.classList.remove('open');
    fsEl.style.transform = '';
    haptic('light');
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

  // Close bar
  if (fsCloseBar) fsCloseBar.addEventListener('click', closeFullscreen);

  // Fullscreen control buttons
  if (fsPlayBtn) {
    fsPlayBtn.addEventListener('click', function() {
      if (typeof window.togglePlay === 'function') window.togglePlay();
    });
  }
  if (fsPrevBtn) {
    fsPrevBtn.addEventListener('click', function() {
      if (typeof window.prevTrack === 'function') window.prevTrack();
    });
  }
  if (fsNextBtn) {
    fsNextBtn.addEventListener('click', function() {
      if (typeof window.nextTrack === 'function') window.nextTrack();
    });
  }
  if (fsShuffleBtn) {
    fsShuffleBtn.addEventListener('click', function() {
      if (typeof window.toggleShuffle === 'function') window.toggleShuffle();
      // Sync after toggling (main btn state updated by app.js)
      setTimeout(syncShuffleRepeatState, 50);
    });
  }
  if (fsRepeatBtn) {
    fsRepeatBtn.addEventListener('click', function() {
      if (typeof window.toggleRepeat === 'function') window.toggleRepeat();
      setTimeout(syncShuffleRepeatState, 50);
    });
  }

  // Fullscreen progress bar seek
  if (fsProgressBar) {
    fsProgressBar.addEventListener('mousedown', function() { fsSeeking = true; });
    fsProgressBar.addEventListener('touchstart', function() { fsSeeking = true; }, { passive: true });
    fsProgressBar.addEventListener('input', function() {
      fsProgressBar.style.setProperty('--fs-progress', fsProgressBar.value + '%');
      if (audio && audio.duration && fsCurrentTime) {
        fsCurrentTime.textContent = formatTime((fsProgressBar.value / 100) * audio.duration);
      }
    });
    var commitFsSeek = function() {
      if (!fsSeeking || !audio || !audio.duration) return;
      audio.currentTime = (fsProgressBar.value / 100) * audio.duration;
      fsSeeking = false;
    };
    ['mouseup', 'touchend', 'change'].forEach(function(ev) {
      fsProgressBar.addEventListener(ev, commitFsSeek);
    });
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
    audio.addEventListener('play', function() { updateMiniPlayer(); updatePlayIcon(); syncShuffleRepeatState(); });
    audio.addEventListener('pause', function() { updatePlayIcon(); });
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', function() { updateMiniPlayer(); updatePlayIcon(); updateDuration(); });
  }

  setInterval(updateMiniPlayer, 1000);

  window.MiniPlayer = { update: updateMiniPlayer, open: openFullscreen, close: closeFullscreen };
})();
