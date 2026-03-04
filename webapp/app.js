// Арабутка — app.js (core: state, queue, player, audio events)
import { MediaSessionManager } from './mediaSession.js';
import {
    escapeHtml, sanitizeCoverUrl, formatTime,
    setLucideIcon, updatePlayButton, updateMuteIcon, updateCoverAnimation,
    applySorting, renderTracks, initUI
} from './app-ui.js';

const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();

const API_URL = (window.Config && window.Config.api && window.Config.api.baseUrl)
    || 'https://arabuthka-production.up.railway.app';

const initData = tg.initData;
const userId = tg.initDataUnsafe?.user?.id;
if (!userId) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-size:18px;">❌ Откройте через Telegram</div>';
    throw new Error('No user_id');
}
const authHeaders = { 'X-Telegram-Init-Data': initData };

// DOM
const audio = document.getElementById('audioPlayer');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const coverArt = document.getElementById('coverArt');
const trackList = document.getElementById('trackList');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeBar = document.getElementById('volumeBar');

// State
const tracks = [], allTracks = [];
let sortMode = 'date', searchQuery = '';
const queue = []; let queueIndex = -1;
let repeatMode = 'none', isShuffled = false;
let unshuffledQueue = [], unshuffledIndex = 0;
let previousVolume = 1, currentObjectUrl = null;

// State accessors (passed to app-ui.js)
function getState() {
    return { tracks, allTracks, searchQuery, sortMode, audio, getActiveTrackId,
             setSearchQuery: v => { searchQuery = v; },
             setSortMode: v => { sortMode = v; } };
}

// Media Session
let mediaSessionManager = null;
if (typeof MediaSessionManager !== 'undefined' && MediaSessionManager.isSupported()) {
    mediaSessionManager = new MediaSessionManager(audio);
    mediaSessionManager.onPrevious(prevTrack);
    mediaSessionManager.onNext(nextTrack);
}

function haptic(type = 'light') {
    if (window.Utils?.haptic) window.Utils.haptic(type);
    else if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred(type);
}

// Queue
function setQueue(list, startIndex = 0) {
    queue.length = 0; list.forEach(t => queue.push({ ...t }));
    queueIndex = startIndex; unshuffledQueue = [...queue]; unshuffledIndex = startIndex;
    if (isShuffled) shuffleQueueKeepCurrent();
}
function shuffleQueueKeepCurrent() {
    if (queue.length <= 1) return;
    const current = queue[queueIndex];
    const rest = queue.filter((_, i) => i !== queueIndex);
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    queue.length = 0; queue.push(current, ...rest); queueIndex = 0;
}
function removeFromQueue(index) {
    if (index < 0 || index >= queue.length || index === queueIndex) return;
    queue.splice(index, 1); if (index < queueIndex) queueIndex--;
}
function getCurrentQueueTrack() {
    return (queueIndex >= 0 && queueIndex < queue.length) ? queue[queueIndex] : null;
}
function getActiveTrackId() { const t = getCurrentQueueTrack(); return t ? t.id : null; }

function addToQueue(track) { queue.push({ ...track }); showToast(`➕ ${track.name} добавлен`); haptic(); }
function playNextInQueue(track) {
    const at = queueIndex >= 0 ? queueIndex + 1 : 0;
    queue.splice(at, 0, { ...track }); showToast(`▶️ ${track.name} — следующий`); haptic();
}
function clearQueue() {
    if (queueIndex >= 0 && queueIndex < queue.length) { const c = queue[queueIndex]; queue.length = 0; queue.push(c); queueIndex = 0; }
    else { queue.length = 0; queueIndex = -1; }
    showToast('🗑️ Очередь очищена');
}

// Toast
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast'); if (!toast) return;
    toast.textContent = message; toast.classList.add('visible');
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    setTimeout(() => toast.classList.remove('visible'), duration);
}

// Load tracks
async function loadTracks() {
    try {
        const fetchFn = window.Network?.fetchWithRetry || fetch;
        const res = await fetchFn(`${API_URL}/tracks`, { headers: authHeaders });
        if (!res.ok) {
            if (res.status === 401) { trackList.innerHTML = '<div class="empty-state">⚠️ Откройте через Telegram</div>'; return; }
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        allTracks.length = 0;
        (Array.isArray(data) ? data : data.tracks).forEach(t => allTracks.push(t));
        applySorting(); renderTracks();
    } catch (err) { trackList.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`; }
}

// File upload
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');
if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        uploadStatus.textContent = 'Загрузка...';
        const formData = new FormData(); formData.append('track', file);
        try {
            const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: authHeaders, body: formData });
            const data = await res.json();
            if (data.success) { uploadStatus.textContent = 'Загружено!'; loadTracks(); setTimeout(() => uploadStatus.textContent = '', 2000); }
            else uploadStatus.textContent = 'Ошибка: ' + (data.error || 'Неизвестно');
        } catch { uploadStatus.textContent = 'Ошибка загрузки'; }
        fileInput.value = '';
    });
}

// Playback
async function playFromQueue() {
    const track = getCurrentQueueTrack(); if (!track) return;
    try {
        const fetchFn = window.Network?.fetchWithRetry || fetch;
        const resp = await fetchFn(`${API_URL}/stream/${track.id}`, { headers: authHeaders });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
        currentObjectUrl = URL.createObjectURL(blob);
        audio.src = currentObjectUrl; audio.play();
    } catch (err) { console.error('Ошибка:', err); if (trackTitle) trackTitle.textContent = '❌ Ошибка'; return; }
    if (trackTitle) trackTitle.textContent = track.name;
    if (trackArtist) trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
    if (coverArt) {
        const cu = sanitizeCoverUrl(track.cover_url);
        coverArt.style.backgroundImage = cu ? `url(${cu})` : ''; coverArt.classList.toggle('has-cover', !!cu);
    }
    updatePlayButton(true); updateCoverAnimation(true); renderTracks(); haptic();
    if (mediaSessionManager) {
        mediaSessionManager.updateMetadata({ name: track.name, artist: track.artist || 'Арабутка', album: track.album || 'Моя музыка' });
        mediaSessionManager.updatePlaybackState('playing');
    }
}

async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    setQueue(tracks, index); await playFromQueue();
}
function togglePlay() {
    if (!audio.src || !queue.length) { if (tracks.length) playTrack(0); return; }
    if (audio.paused) audio.play().catch(e => console.log(e)); else audio.pause();
}
function nextTrack() {
    if (!queue.length) return;
    if (repeatMode === 'one') { audio.currentTime = 0; audio.play(); return; }
    if (queueIndex < queue.length - 1) queueIndex++;
    else if (repeatMode === 'all') queueIndex = 0;
    else { updatePlayButton(false); updateCoverAnimation(false); if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused'); return; }
    playFromQueue();
}
function prevTrack() {
    if (!queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (queueIndex > 0) queueIndex--;
    else if (repeatMode === 'all') queueIndex = queue.length - 1;
    else { audio.currentTime = 0; return; }
    playFromQueue();
}

// Delete
async function doDeleteTrack(id) {
    try {
        const res = await fetch(`${API_URL}/tracks/${id}`, { method: 'DELETE', headers: authHeaders });
        const data = await res.json();
        if (data.success) { const qi = queue.findIndex(t => t.id === id); if (qi >= 0 && qi !== queueIndex) removeFromQueue(qi); loadTracks(); }
        else showToast('❌ Ошибка: ' + (data.error || ''));
    } catch { showToast('❌ Ошибка сети'); }
}
async function deleteTrack(id) {
    if (tg.showConfirm) tg.showConfirm('Удалить этот трек?', async ok => { if (ok) await doDeleteTrack(id); });
    else { if (!confirm('Удалить этот трек?')) return; await doDeleteTrack(id); }
}

// Shuffle & Repeat
function toggleShuffle() {
    isShuffled = !isShuffled;
    const btn = document.getElementById('shuffleBtn'); if (btn) btn.classList.toggle('active', isShuffled);
    if (isShuffled) { unshuffledQueue = [...queue]; unshuffledIndex = queueIndex; shuffleQueueKeepCurrent(); }
    else {
        const cur = getCurrentQueueTrack();
        if (unshuffledQueue.length) {
            queue.length = 0; unshuffledQueue.forEach(t => queue.push(t));
            const idx = cur ? queue.findIndex(t => t.id === cur.id) : -1;
            queueIndex = idx >= 0 ? idx : unshuffledIndex;
        }
    }
    haptic();
}
function toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    const btn = document.getElementById('repeatBtn');
    if (btn) { btn.classList.toggle('active', repeatMode !== 'none'); setLucideIcon(btn, repeatMode === 'one' ? 'repeat-1' : 'repeat'); }
    haptic();
}
function toggleMute() {
    if (audio.volume > 0) { previousVolume = audio.volume; audio.volume = 0; if (volumeBar) volumeBar.value = 0; updateMuteIcon(0); }
    else { audio.volume = previousVolume; if (volumeBar) volumeBar.value = previousVolume * 100; updateMuteIcon(previousVolume); }
}

// Audio events
audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    if (progressBar) progressBar.value = (audio.currentTime / audio.duration) * 100;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
});
audio.addEventListener('loadedmetadata', () => {
    if (durationEl) durationEl.textContent = formatTime(audio.duration);
    if (progressBar) progressBar.max = 100;
});
audio.addEventListener('ended', () => {
    if (repeatMode === 'one') { audio.currentTime = 0; audio.play(); }
    else if (repeatMode === 'all' || queueIndex < queue.length - 1) nextTrack();
    else { updatePlayButton(false); updateCoverAnimation(false); if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused'); }
});
audio.addEventListener('play', () => { updatePlayButton(true); updateCoverAnimation(true); renderTracks(); if (mediaSessionManager) mediaSessionManager.updatePlaybackState('playing'); });
audio.addEventListener('pause', () => { updatePlayButton(false); updateCoverAnimation(false); renderTracks(); if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused'); });
audio.addEventListener('error', () => { const e = audio.error; const m = e ? `Ошибка: code=${e.code}` : 'Неизвестная ошибка'; console.error(m); if (trackTitle) trackTitle.textContent = m; });

if (progressBar) {
    let isSeeking = false;
    progressBar.addEventListener('mousedown', () => isSeeking = true);
    progressBar.addEventListener('touchstart', () => isSeeking = true, { passive: true });
    progressBar.addEventListener('input', () => { if (audio.duration && currentTimeEl) currentTimeEl.textContent = formatTime((progressBar.value / 100) * audio.duration); });
    const commitSeek = () => { if (!isSeeking || !audio.duration) return; audio.currentTime = (progressBar.value / 100) * audio.duration; isSeeking = false; };
    ['mouseup', 'touchend', 'change'].forEach(ev => progressBar.addEventListener(ev, commitSeek));
}
if (volumeBar) volumeBar.addEventListener('input', () => { audio.volume = volumeBar.value / 100; updateMuteIcon(audio.volume); });

// Window exports
window.togglePlay = togglePlay; window.prevTrack = prevTrack; window.nextTrack = nextTrack;
window.toggleShuffle = toggleShuffle; window.toggleRepeat = toggleRepeat; window.toggleMute = toggleMute;
window.playTrack = playTrack; window.deleteTrack = deleteTrack;
window.addToQueue = addToQueue; window.playNextInQueue = playNextInQueue; window.clearQueue = clearQueue;
window.getCurrentQueueTrack = getCurrentQueueTrack; window.showToast = showToast;

// Init
loadTracks();
initUI(getState);

// Wire playlists section
const playlistsSection = document.getElementById('playlistsSection');
if (playlistsSection && window.PlaylistManager) {
    window.PlaylistManager.loadAndRender(playlistsSection);
}
