// Арабутка — Light Neon
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

import { MediaSessionManager } from './mediaSession.js';

const API_URL = (window.Config && window.Config.api && window.Config.api.baseUrl) || 'https://arabuthka-production.up.railway.app';

// Авторизация
const initData = tg.initData;
const userId = tg.initDataUnsafe?.user?.id;

if (!userId) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-size:18px;">❌ Откройте через Telegram</div>';
    throw new Error('No user_id');
}

const authHeaders = { 'X-Telegram-Init-Data': initData };

// ===========================================
// DOM ЭЛЕМЕНТЫ
// ===========================================
const audio = document.getElementById('audioPlayer');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const coverArt = document.getElementById('coverArt');
const trackList = document.getElementById('trackList');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeBar = document.getElementById('volumeBar');
const playBtn = document.getElementById('playBtn');
const muteBtn = document.getElementById('muteBtn');

// ===========================================
// MEDIA SESSION
// ===========================================
let mediaSessionManager = null;
if (typeof MediaSessionManager !== 'undefined' && MediaSessionManager.isSupported()) {
    mediaSessionManager = new MediaSessionManager(audio);
    mediaSessionManager.onPrevious(prevTrack);
    mediaSessionManager.onNext(nextTrack);
}

// ===========================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ===========================================

// Display state (отображение списка)
let tracks = [];       // текущий отфильтрованный/отсортированный список
let allTracks = [];    // все треки с сервера
let searchQuery = '';
let sortMode = 'date';

// Queue state (очередь воспроизведения — отдельна от display)
let queue = [];           // массив треков в очереди
let queueIndex = -1;      // текущая позиция в очереди (-1 = ничего не играет)
let unshuffledQueue = []; // копия очереди до shuffle (для отмены)
let unshuffledIndex = 0;

// Player state
let isShuffled = false;
let repeatMode = 'none'; // none, all, one
let previousVolume = 1;
let currentObjectUrl = null;

// ===========================================
// УТИЛИТЫ БЕЗОПАСНОСТИ
// ===========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeCoverUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'data:') return url;
    } catch (e) {}
    return '';
}

function revokeCurrentObjectUrl() {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===========================================
// LUCIDE ICON HELPERS
// ===========================================
function setLucideIcon(element, iconName) {
    if (!element) return;
    element.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) lucide.createIcons({ nodes: [element] });
}

function updatePlayButton(isPlaying) {
    setLucideIcon(playBtn, isPlaying ? 'pause' : 'play');
}

function updateMuteIcon(vol) {
    if (!muteBtn) return;
    const icon = vol === 0 ? 'volume-x' : vol < 0.5 ? 'volume-1' : 'volume-2';
    setLucideIcon(muteBtn, icon);
}

function updateCoverAnimation(isPlaying) {
    if (!coverArt) return;
    coverArt.classList.toggle('paused', !isPlaying);
}

function haptic(type = 'light') {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred(type);
}

// ===========================================
// ОЧЕРЕДЬ ВОСПРОИЗВЕДЕНИЯ (QUEUE)
// Отделена от display-списка: фильтрация/сортировка
// не ломает порядок воспроизведения.
// ===========================================

/** Заменить очередь и начать воспроизведение с позиции startIndex */
function setQueue(trackList, startIndex = 0) {
    queue = trackList.map(t => ({ ...t }));
    queueIndex = startIndex;
    unshuffledQueue = [...queue];
    unshuffledIndex = startIndex;
    if (isShuffled) {
        shuffleQueueKeepCurrent();
    }
}

/** Fisher-Yates shuffle, текущий трек остаётся на позиции 0 */
function shuffleQueueKeepCurrent() {
    if (queue.length <= 1) return;
    const current = queue[queueIndex];
    const rest = queue.filter((_, i) => i !== queueIndex);
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    queue = [current, ...rest];
    queueIndex = 0;
}

/** Добавить трек в конец очереди */
function addToQueue(track) {
    queue.push({ ...track });
    showToast(`➕ ${track.name} добавлен в очередь`);
    haptic('light');
}

/** Вставить трек сразу после текущего («следующий») */
function playNextInQueue(track) {
    const insertAt = queueIndex >= 0 ? queueIndex + 1 : 0;
    queue.splice(insertAt, 0, { ...track });
    showToast(`▶️ ${track.name} — следующий`);
    haptic('light');
}

/** Удалить трек из очереди по индексу */
function removeFromQueue(index) {
    if (index < 0 || index >= queue.length || index === queueIndex) return;
    queue.splice(index, 1);
    if (index < queueIndex) queueIndex--;
}

/** Очистить очередь (кроме текущего трека) */
function clearQueue() {
    if (queueIndex >= 0 && queueIndex < queue.length) {
        const current = queue[queueIndex];
        queue = [current];
        queueIndex = 0;
    } else {
        queue = [];
        queueIndex = -1;
    }
    showToast('🗑️ Очередь очищена');
}

/** Получить текущий трек из очереди */
function getCurrentQueueTrack() {
    return (queueIndex >= 0 && queueIndex < queue.length) ? queue[queueIndex] : null;
}

/** ID текущего трека (для подсветки в списке) */
function getActiveTrackId() {
    const t = getCurrentQueueTrack();
    return t ? t.id : null;
}

// ===========================================
// ЗАГРУЗКА ФАЙЛОВ
// ===========================================
if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadStatus.textContent = 'Загрузка...';
        const formData = new FormData();
        formData.append('track', file);
        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: authHeaders,
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                uploadStatus.textContent = 'Загружено!';
                loadTracks();
                setTimeout(() => uploadStatus.textContent = '', 2000);
            } else {
                uploadStatus.textContent = 'Ошибка: ' + (data.error || 'Неизвестно');
            }
        } catch (err) {
            uploadStatus.textContent = 'Ошибка загрузки';
        }
        fileInput.value = '';
    });
}

// ===========================================
// ЗАГРУЗКА ТРЕКОВ С СЕРВЕРА
// ===========================================
async function loadTracks() {
    try {
        const res = await fetch(`${API_URL}/tracks`, { headers: authHeaders });
        if (!res.ok) {
            if (res.status === 401) {
                trackList.innerHTML = '<div class="empty-state">⚠️ Откройте через Telegram</div>';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const loaded = Array.isArray(data) ? data : data.tracks;
        allTracks = [...loaded];
        applySorting();
        renderTracks();
    } catch (err) {
        trackList.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
}

// ===========================================
// СОРТИРОВКА И ФИЛЬТРАЦИЯ (display only)
// ===========================================
function applySorting() {
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        tracks = allTracks.filter(t =>
            t.name.toLowerCase().includes(q) ||
            (t.artist && t.artist.toLowerCase().includes(q)) ||
            (t.album && t.album.toLowerCase().includes(q))
        );
    } else {
        tracks = [...allTracks];
    }
    if (sortMode === 'name') {
        tracks.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    } else {
        tracks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
}

// ===========================================
// ОТРИСОВКА СПИСКА ТРЕКОВ
// ===========================================
function renderTracks() {
    if (!trackList) return;
    if (tracks.length === 0) {
        trackList.innerHTML = searchQuery
            ? '<div class="empty-state">🔍 Ничего не найдено</div>'
            : '<div class="empty-state">🎵 Загрузи свой первый трек!</div>';
        return;
    }
    const activeId = getActiveTrackId();
    trackList.innerHTML = tracks.map((track, index) => {
        const isActive = track.id === activeId;
        const isPlaying = isActive && !audio.paused;
        const equalizerHtml = isPlaying
            ? '<div class="equalizer"><div class="equalizer-bar"></div><div class="equalizer-bar"></div><div class="equalizer-bar"></div><div class="equalizer-bar"></div></div>'
            : '';
        return `<div class="track-item ${isActive ? 'active' : ''}" data-swipe-index="${index}" onclick="playTrack(${index})">
            <span class="track-number">${index + 1}</span>
            <div class="track-info-item">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist-small">${escapeHtml(track.artist || 'Неизвестный исполнитель')}</div>
            </div>
            ${equalizerHtml}
            <button class="track-delete" onclick="event.stopPropagation(); deleteTrack(${Number(track.id)})">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
        </div>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

// ===========================================
// ВОСПРОИЗВЕДЕНИЕ
// ===========================================

/** Начать воспроизведение из очереди (текущий queueIndex) */
async function playFromQueue() {
    const track = getCurrentQueueTrack();
    if (!track) return;
    try {
        const resp = await fetch(`${API_URL}/stream/${track.id}`, { headers: authHeaders });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        revokeCurrentObjectUrl();
        currentObjectUrl = URL.createObjectURL(blob);
        audio.src = currentObjectUrl;
        audio.play();
    } catch (err) {
        console.error('Ошибка воспроизведения:', err);
        if (trackTitle) trackTitle.textContent = '❌ Ошибка загрузки';
        return;
    }
    // Обновить UI
    if (trackTitle) trackTitle.textContent = track.name;
    if (trackArtist) trackArtist.textContent = track.artist || 'Неизвестный исполнитель';
    if (coverArt) {
        const coverUrl = sanitizeCoverUrl(track.cover_url);
        coverArt.style.backgroundImage = coverUrl ? `url(${coverUrl})` : '';
        coverArt.classList.toggle('has-cover', !!coverUrl);
    }
    updatePlayButton(true);
    updateCoverAnimation(true);
    renderTracks();
    haptic('light');
    // Media Session
    if (mediaSessionManager) {
        mediaSessionManager.updateMetadata({
            name: track.name,
            artist: track.artist || 'Арабутка',
            album: track.album || 'Моя музыка'
        });
        mediaSessionManager.updatePlaybackState('playing');
    }
}

/** Клик по треку в списке — установить очередь из текущего display, играть с index */
async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    setQueue(tracks, index);
    await playFromQueue();
}

function togglePlay() {
    if (!audio.src || queue.length === 0) {
        if (tracks.length > 0) {
            playTrack(0);
        }
        return;
    }
    if (audio.paused) {
        audio.play().catch(err => console.log('Ошибка воспроизведения:', err));
    } else {
        audio.pause();
    }
}

function nextTrack() {
    if (queue.length === 0) return;
    if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
    }
    if (queueIndex < queue.length - 1) {
        queueIndex++;
    } else if (repeatMode === 'all') {
        queueIndex = 0;
    } else {
        // Конец очереди, repeat off
        updatePlayButton(false);
        updateCoverAnimation(false);
        if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused');
        return;
    }
    playFromQueue();
}

function prevTrack() {
    if (queue.length === 0) return;
    // Если прошло больше 3с — перемотать в начало
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    if (queueIndex > 0) {
        queueIndex--;
    } else if (repeatMode === 'all') {
        queueIndex = queue.length - 1;
    } else {
        audio.currentTime = 0;
        return;
    }
    playFromQueue();
}

// ===========================================
// УДАЛЕНИЕ ТРЕКА
// ===========================================
async function deleteTrack(id) {
    if (!confirm('Удалить этот трек?')) return;
    try {
        const res = await fetch(`${API_URL}/tracks/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        const data = await res.json();
        if (data.success) {
            // Удалить из очереди тоже
            const qIdx = queue.findIndex(t => t.id === id);
            if (qIdx >= 0 && qIdx !== queueIndex) {
                removeFromQueue(qIdx);
            }
            loadTracks();
        } else {
            alert('Ошибка удаления: ' + (data.error || 'Неизвестно'));
        }
    } catch (err) {
        alert('Ошибка сети при удалении');
    }
}

// ===========================================
// SHUFFLE И REPEAT
// ===========================================
function toggleShuffle() {
    isShuffled = !isShuffled;
    const btn = document.getElementById('shuffleBtn');
    if (btn) btn.classList.toggle('active', isShuffled);
    if (isShuffled) {
        // Сохраняем оригинал и шафлим
        unshuffledQueue = [...queue];
        unshuffledIndex = queueIndex;
        shuffleQueueKeepCurrent();
    } else {
        // Восстанавливаем оригинальный порядок
        const currentTrack = getCurrentQueueTrack();
        if (unshuffledQueue.length > 0) {
            queue = [...unshuffledQueue];
            // Найти текущий трек в оригинальном порядке
            if (currentTrack) {
                const idx = queue.findIndex(t => t.id === currentTrack.id);
                queueIndex = idx >= 0 ? idx : unshuffledIndex;
            } else {
                queueIndex = unshuffledIndex;
            }
        }
    }
    haptic('light');
}

function toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    repeatMode = modes[(idx + 1) % modes.length];
    const btn = document.getElementById('repeatBtn');
    if (btn) {
        btn.classList.toggle('active', repeatMode !== 'none');
        setLucideIcon(btn, repeatMode === 'one' ? 'repeat-1' : 'repeat');
    }
    haptic('light');
}

// ===========================================
// ГРОМКОСТЬ И МЬЮТ
// ===========================================
function toggleMute() {
    if (audio.volume > 0) {
        previousVolume = audio.volume;
        audio.volume = 0;
        if (volumeBar) volumeBar.value = 0;
        updateMuteIcon(0);
    } else {
        audio.volume = previousVolume;
        if (volumeBar) volumeBar.value = previousVolume * 100;
        updateMuteIcon(previousVolume);
    }
}

// ===========================================
// ОБРАБОТЧИКИ АУДИО-СОБЫТИЙ
// ===========================================
audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    if (progressBar) progressBar.value = progress;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
    if (durationEl) durationEl.textContent = formatTime(audio.duration);
    if (progressBar) progressBar.max = 100;
});

audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
    } else if (repeatMode === 'all' || queueIndex < queue.length - 1) {
        nextTrack();
    } else {
        updatePlayButton(false);
        updateCoverAnimation(false);
        if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused');
    }
});

audio.addEventListener('play', () => {
    updatePlayButton(true);
    updateCoverAnimation(true);
    renderTracks();
    if (mediaSessionManager) mediaSessionManager.updatePlaybackState('playing');
});

audio.addEventListener('pause', () => {
    updatePlayButton(false);
    updateCoverAnimation(false);
    renderTracks();
    if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused');
});

audio.addEventListener('error', () => {
    const err = audio.error;
    const msg = err ? `Ошибка аудио: code=${err.code}` : 'Неизвестная ошибка';
    console.error(msg);
    if (trackTitle) trackTitle.textContent = msg;
});

// ===========================================
// ОБРАБОТЧИКИ UI-ЭЛЕМЕНТОВ
// ===========================================

// Прогресс-бар: seeking
if (progressBar) {
    let isSeeking = false;

    progressBar.addEventListener('mousedown', () => { isSeeking = true; });
    progressBar.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });

    progressBar.addEventListener('input', () => {
        if (!audio.duration) return;
        const seekTime = (progressBar.value / 100) * audio.duration;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(seekTime);
    });

    function commitSeek() {
        if (!isSeeking || !audio.duration) return;
        audio.currentTime = (progressBar.value / 100) * audio.duration;
        isSeeking = false;
    }
    progressBar.addEventListener('mouseup', commitSeek);
    progressBar.addEventListener('touchend', commitSeek);
    progressBar.addEventListener('change', commitSeek);
}

// Громкость
if (volumeBar) {
    volumeBar.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
        updateMuteIcon(audio.volume);
    });
}

// Локальный поиск (фильтрация списка, не меняет очередь!)
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');

if (searchInput) {
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        if (clearSearch) clearSearch.style.display = searchQuery ? 'flex' : 'none';
        applySorting();
        renderTracks();
    });
}

if (clearSearch) {
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearch.style.display = 'none';
        applySorting();
        renderTracks();
    });
}

// Сортировка (только display, очередь не трогаем)
document.querySelectorAll('.sort-btn[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
        sortMode = btn.getAttribute('data-sort');
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applySorting();
        renderTracks();
    });
});

// ===========================================
// ЭКСПОРТ В WINDOW
// ===========================================
window.togglePlay = togglePlay;
window.prevTrack = prevTrack;
window.nextTrack = nextTrack;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.toggleMute = toggleMute;
window.playTrack = playTrack;
window.deleteTrack = deleteTrack;
window.addToQueue = addToQueue;
window.playNextInQueue = playNextInQueue;
window.clearQueue = clearQueue;

// ===========================================
// ИНИЦИАЛИЗАЦИЯ
// ===========================================
loadTracks();

// ===========================================
// ГЛОБАЛЬНЫЙ ПОИСК МУЗЫКИ
// ===========================================
(function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const searchBtn = document.getElementById('globalSearchBtn');
    const resultsContainer = document.getElementById('globalSearchResults');
    if (!searchInput || !searchBtn || !resultsContainer) return;

    let searchTimeout = null;

    async function performSearch(query) {
        if (!query || query.trim().length < 2) {
            resultsContainer.innerHTML = '<div class="search-placeholder">Введите запрос для поиска</div>';
            return;
        }
        resultsContainer.innerHTML = '<div class="search-loading"></div>';
        try {
            const res = await fetch(`${API_URL}/api/search/all?q=${encodeURIComponent(query.trim())}`, {
                headers: authHeaders
            });
            const data = await res.json();
            const results = data.results || data.tracks || data || [];
            if (!Array.isArray(results) || results.length === 0) {
                resultsContainer.innerHTML = '<div class="search-placeholder">Ничего не найдено</div>';
                return;
            }
            resultsContainer.innerHTML = results.map((track, i) => {
                const title = escapeHtml(track.name || track.title || 'Без названия');
                const artist = escapeHtml(track.artist || 'Неизвестный');
                const coverUrl = sanitizeCoverUrl(track.cover);
                const coverHtml = coverUrl
                    ? `<img class="search-result-cover" src="${escapeHtml(coverUrl)}" alt="" loading="lazy">`
                    : '<div class="search-result-cover no-cover"></div>';
                return `<div class="search-result-item">
                    ${coverHtml}
                    <div class="search-result-info">
                        <div class="search-result-title">${title}</div>
                        <div class="search-result-artist">${artist}</div>
                    </div>
                    <button class="search-result-btn play-btn" onclick="playSearchResult(${i})">
                        <i data-lucide="play" style="width:16px;height:16px"></i>
                    </button>
                    ${!track.isDownloaded ? `<button class="search-result-btn" onclick="downloadSearchResult(${i})">
                        <i data-lucide="download" style="width:16px;height:16px"></i>
                    </button>` : ''}
                </div>`;
            }).join('');
            window._searchResults = results;
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            resultsContainer.innerHTML = `<div class="search-placeholder">Ошибка поиска: ${escapeHtml(err.message)}</div>`;
        }
    }

    searchBtn.addEventListener('click', () => performSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); performSearch(searchInput.value); }
    });
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(searchInput.value), 600);
    });
})();

function playSearchResult(index) {
    const results = window._searchResults;
    if (!results || !results[index]) return;
    const track = results[index];
    if (track.url) {
        revokeCurrentObjectUrl();
        audio.src = track.url;
        audio.play().catch(err => console.log('Ошибка:', err));
        if (trackTitle) trackTitle.textContent = track.name || track.title || 'Без названия';
        if (trackArtist) trackArtist.textContent = track.artist || 'Неизвестный';
        updatePlayButton(true);
        updateCoverAnimation(true);
    }
}
window.playSearchResult = playSearchResult;

async function downloadSearchResult(index) {
    const results = window._searchResults;
    if (!results || !results[index]) return;
    const track = results[index];
    const btns = document.querySelectorAll('.search-result-item');
    const btn = btns[index]?.querySelector('.search-result-btn:not(.play-btn)');
    if (btn) {
        btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;animation:spin 1s linear infinite"></i>';
        btn.disabled = true;
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }
    try {
        const res = await fetch(`${API_URL}/api/search/download`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                previewUrl: track.previewUrl || track.url,
                title: track.title || track.name,
                artist: track.artist || ''
            })
        });
        const data = await res.json();
        if (data.success) {
            if (btn) { setLucideIcon(btn, 'check'); btn.title = 'Добавлено'; }
            loadTracks();
        } else {
            if (btn) setLucideIcon(btn, 'x');
            console.error('Ошибка скачивания:', data.error);
        }
    } catch (err) {
        if (btn) setLucideIcon(btn, 'x');
        console.error('Ошибка:', err);
    }
}
window.downloadSearchResult = downloadSearchResult;

// ===========================================
// TOAST NOTIFICATIONS
// ===========================================
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    setTimeout(() => toast.classList.remove('visible'), duration);
}
window.showToast = showToast;

// ===========================================
// SWIPE GESTURES FOR TRACK ITEMS
// ===========================================
(function initSwipeGestures() {
    const trackListEl = document.getElementById('trackList');
    if (!trackListEl) return;

    let startX = 0;
    let startY = 0;
    let currentEl = null;
    let isDragging = false;
    const THRESHOLD = 70;

    trackListEl.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.track-item');
        if (!item) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentEl = item;
        isDragging = false;
        item.classList.remove('snap-back');
        item.classList.add('swiping');
    }, { passive: true });

    trackListEl.addEventListener('touchmove', (e) => {
        if (!currentEl) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (!isDragging && Math.abs(dy) > Math.abs(dx)) { currentEl = null; return; }
        isDragging = true;
        currentEl.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`;
    }, { passive: true });

    trackListEl.addEventListener('touchend', () => {
        if (!currentEl) return;
        const transform = currentEl.style.transform;
        const match = transform.match(/translateX\(([\-\d.]+)px\)/);
        const dx = match ? parseFloat(match[1]) : 0;
        currentEl.classList.remove('swiping');
        currentEl.classList.add('snap-back');
        if (dx > THRESHOLD) {
            // Свайп вправо — добавить в очередь
            const index = currentEl.getAttribute('data-swipe-index');
            if (index !== null && tracks[index]) {
                addToQueue(tracks[index]);
            }
        } else if (dx < -THRESHOLD) {
            const index = currentEl.getAttribute('data-swipe-index');
            if (index !== null && tracks[index]) {
                deleteTrack(tracks[index].id);
            }
        }
        currentEl.style.transform = 'translateX(0)';
        currentEl = null;
        isDragging = false;
    }, { passive: true });
})();

// ===========================================
// BOTTOM NAV WITH DATA-TAB
// ===========================================
(function initBottomNav() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    if (!navItems.length) return;

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const tab = item.getAttribute('data-tab');
            switch (tab) {
                case 'home':
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    break;
                case 'library':
                    const tl = document.getElementById('trackList');
                    if (tl) tl.scrollIntoView({ behavior: 'smooth' });
                    break;
                case 'search':
                    const gs = document.querySelector('.global-search-section');
                    if (gs) {
                        gs.scrollIntoView({ behavior: 'smooth' });
                        const inp = document.getElementById('globalSearchInput');
                        if (inp) setTimeout(() => inp.focus(), 400);
                    }
                    break;
                case 'profile':
                    const user = tg.initDataUnsafe?.user;
                    if (user) {
                        showToast(`👤 ${user.first_name || ''} • ${allTracks.length} треков`);
                    }
                    break;
            }
            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });
    });
})();

// ===========================================
// KEYBOARD SHORTCUTS (для desktop/devtools)
// ===========================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); nextTrack(); break;
        case 'ArrowLeft': e.preventDefault(); prevTrack(); break;
        case 'KeyS': if (!e.ctrlKey) toggleShuffle(); break;
        case 'KeyR': if (!e.ctrlKey) toggleRepeat(); break;
        case 'KeyM': toggleMute(); break;
    }
});
