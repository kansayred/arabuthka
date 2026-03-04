/**
 * PlaylistManager — CRUD плейлистов + UI
 * API: /playlists (auth required)
 * Native Telegram dialogs where possible; custom dialog for text input.
 */
(function() {
  'use strict';

  var API_URL = (window.Config && window.Config.api && window.Config.api.baseUrl)
    || 'https://arabuthka-production.up.railway.app';

  function getAuth() {
    var tg = window.Telegram && window.Telegram.WebApp;
    return (tg && tg.initData) ? { 'X-Telegram-Init-Data': tg.initData } : {};
  }
  function esc(t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
  function haptic(type) { var tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(type || 'light'); }
  function toast(msg) { if (typeof window.showToast === 'function') window.showToast(msg); }

  // ========== PlaylistManager ==========
  function PlaylistManager() {
    this.playlists = [];
    this.currentPlaylist = null;
    this.container = null;
  }

  // --- API ---
  PlaylistManager.prototype.fetchAll = async function() {
    var res = await fetch(API_URL + '/playlists', { headers: getAuth() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    this.playlists = Array.isArray(data) ? data : (data.playlists || []);
    return this.playlists;
  };
  PlaylistManager.prototype.create = async function(name, description) {
    var res = await fetch(API_URL + '/playlists', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuth()),
      body: JSON.stringify({ name: name, description: description || '' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  };
  PlaylistManager.prototype.remove = async function(id) {
    var res = await fetch(API_URL + '/playlists/' + id, { method: 'DELETE', headers: getAuth() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  };
  PlaylistManager.prototype.fetchTracks = async function(id) {
    var res = await fetch(API_URL + '/playlists/' + id, { headers: getAuth() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    this.currentPlaylist = data;
    return data;
  };
  PlaylistManager.prototype.addTrack = async function(playlistId, trackId) {
    var res = await fetch(API_URL + '/playlists/' + playlistId + '/tracks', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuth()),
      body: JSON.stringify({ trackId: trackId })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  };
  PlaylistManager.prototype.removeTrack = async function(playlistId, trackId) {
    var res = await fetch(API_URL + '/playlists/' + playlistId + '/tracks/' + trackId,
      { method: 'DELETE', headers: getAuth() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  };

  // --- Render list ---
  PlaylistManager.prototype.renderList = function(container) {
    this.container = container || this.container;
    if (!this.container) return;
    if (this.playlists.length === 0) {
      this.container.innerHTML = '<div class="empty-state"><p>\uD83C\uDFB5 Плейлистов пока нет</p>'
        + '<button class="btn-primary" onclick="window.PlaylistManager.showCreateDialog()">Создать первый</button></div>';
      return;
    }
    var html = '<div class="playlist-header"><h3>Мои плейлисты</h3>'
      + '<button class="btn-icon" onclick="window.PlaylistManager.showCreateDialog()" aria-label="Создать плейлист">'
      + '<i data-lucide="plus" style="width:20px;height:20px" aria-hidden="true"></i></button></div>';
    html += this.playlists.map(function(pl) {
      return '<div class="playlist-item card" data-id="' + pl.id + '" onclick="window.PlaylistManager.openPlaylist(' + pl.id + ')">'
        + '<div class="playlist-item-info"><div class="playlist-item-name">' + esc(pl.name) + '</div>'
        + '<div class="playlist-item-count">' + (pl.track_count || 0) + ' треков</div></div>'
        + '<button class="btn-icon" onclick="event.stopPropagation();window.PlaylistManager.confirmDelete(' + pl.id + ')" aria-label="Удалить плейлист">'
        + '<i data-lucide="trash-2" style="width:16px;height:16px" aria-hidden="true"></i></button></div>';
    }).join('');
    this.container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  };

  // --- Render tracks ---
  PlaylistManager.prototype.renderTracks = function(data) {
    if (!this.container) return;
    var pl = data.playlist || data;
    var tracks = data.tracks || pl.tracks || [];
    var html = '<div class="playlist-header">'
      + '<button class="btn-icon" onclick="window.PlaylistManager.loadAndRender()" aria-label="Назад">'
      + '<i data-lucide="arrow-left" style="width:20px;height:20px" aria-hidden="true"></i></button>'
      + '<h3>' + esc(pl.name) + '</h3></div>';
    if (tracks.length === 0) {
      html += '<div class="empty-state">В плейлисте пока нет треков</div>';
    } else {
      html += '<div class="playlist-tracks" id="playlistTracksContainer">';
      html += tracks.map(function(t, i) {
        return '<div class="track-item" draggable="true" data-track-id="' + t.id + '" data-position="' + i + '">'
          + '<span class="track-number">' + (i + 1) + '</span>'
          + '<div class="track-info-item"><div class="track-name">' + esc(t.name) + '</div>'
          + '<div class="track-artist-small">' + esc(t.artist || 'Неизвестный') + '</div></div>'
          + '<button class="btn-icon" onclick="event.stopPropagation();window.PlaylistManager.removeTrackFromCurrent(' + t.id + ')" aria-label="Убрать из плейлиста">'
          + '<i data-lucide="x" style="width:14px;height:14px" aria-hidden="true"></i></button></div>';
      }).join('');
      html += '</div>';
    }
    this.container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    this.initDragDrop();
  };

  // --- Drag & Drop (unchanged) ---
  PlaylistManager.prototype.initDragDrop = function() {
    var container = document.getElementById('playlistTracksContainer');
    if (!container) return;
    var dragEl = null;
    container.addEventListener('dragstart', function(e) {
      dragEl = e.target.closest('.track-item');
      if (dragEl) { dragEl.style.opacity = '0.5'; e.dataTransfer.effectAllowed = 'move'; }
    });
    container.addEventListener('dragover', function(e) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      var target = e.target.closest('.track-item');
      if (target && target !== dragEl) {
        var mid = target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
        if (e.clientY < mid) container.insertBefore(dragEl, target);
        else container.insertBefore(dragEl, target.nextSibling);
      }
    });
    container.addEventListener('dragend', function() { if (dragEl) dragEl.style.opacity = '1'; dragEl = null; });
  };

  // --- Create dialog (custom bottom-sheet) ---
  PlaylistManager.prototype.showCreateDialog = function() {
    var self = this;
    var dialog = document.getElementById('playlistDialog');
    var input = document.getElementById('playlistNameInput');
    var okBtn = document.getElementById('playlistDialogOk');
    var cancelBtn = document.getElementById('playlistDialogCancel');
    if (!dialog || !input) return;
    input.value = '';
    dialog.style.display = 'flex';
    setTimeout(function() { input.focus(); }, 100);
    function close() { dialog.style.display = 'none'; okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', close); }
    function onOk() {
      var name = input.value.trim(); if (!name) return;
      close();
      self.create(name).then(function() { toast('\u2705 Плейлист создан'); haptic('light'); self.loadAndRender(); })
        .catch(function(err) { toast('\u274c Ошибка: ' + err.message); });
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', close);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') onOk(); });
  };

  // --- Delete confirm (Telegram-native) ---
  PlaylistManager.prototype.confirmDelete = function(id) {
    var self = this;
    var tg = window.Telegram && window.Telegram.WebApp;
    function doDelete() {
      self.remove(id).then(function() { toast('\uD83D\uDDD1\uFE0F Плейлист удалён'); haptic('medium'); self.loadAndRender(); })
        .catch(function(err) { toast('\u274c Ошибка: ' + err.message); });
    }
    if (tg && tg.showConfirm) tg.showConfirm('Удалить плейлист?', function(ok) { if (ok) doDelete(); });
    else { if (!confirm('Удалить плейлист?')) return; doDelete(); }
  };

  PlaylistManager.prototype.openPlaylist = function(id) {
    var self = this;
    this.fetchTracks(id).then(function(data) { self.renderTracks(data); }).catch(function(err) { toast('\u274c ' + err.message); });
  };

  PlaylistManager.prototype.removeTrackFromCurrent = function(trackId) {
    if (!this.currentPlaylist) return;
    var plId = this.currentPlaylist.id || (this.currentPlaylist.playlist && this.currentPlaylist.playlist.id);
    var self = this;
    this.removeTrack(plId, trackId).then(function() { toast('\u2705 Трек убран'); self.openPlaylist(plId); })
      .catch(function(err) { toast('\u274c ' + err.message); });
  };

  PlaylistManager.prototype.loadAndRender = function(container) {
    if (container) this.container = container;
    var self = this;
    return this.fetchAll().then(function() { self.renderList(); })
      .catch(function(err) { if (self.container) self.container.innerHTML = '<div class="empty-state">\u274c ' + esc(err.message) + '</div>'; });
  };

  window.PlaylistManager = new PlaylistManager();
})();
