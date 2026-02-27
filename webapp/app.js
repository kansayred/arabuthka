// Арабутка — Театральный редизайн
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Media Session API
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

// DOM элементы
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

// Sticky Player
const stickyPlayer = document.getElementById('stickyPlayer');
const miniCover = document.getElementById('miniCover');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniPlayBtn = document.getElementById('miniPlayBtn');

// Media Session
let mediaSessionManager = null;
if (typeof MediaSessionManager !== 'undefined' && MediaSessionManager.isSupported()) {
    mediaSessionManager = new MediaSessionManager(audio);
    mediaSessionManager.onPrevious(prevTrack);
    mediaSessionManager.onNext(nextTrack);
}

// Состояние приложения
let tracks = [];
let currentIndex = 0;
let isShuffled = false;
let repeatMode = 'none'; // none, all, one
let shuffledIndices = [];
let previousVolume = 1;
let searchQuery = '';
let sortMode = 'date';
let allTracks = [];
let currentObjectUrl = null; // для очистки Object URL

// ===========================================
// УТИЛИТЫ БЕЗОПАСНОСТИ
// ===========================================

// Защита от XSS при вставке пользовательских данных в HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Валидация URL обложки — только https и data:image
function sanitizeCoverUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'data:') {
            return url;
        }
    } catch (e) {
        // невалидный URL
    }
    return '';
}

// Очистка предыдущего Object URL
function revokeCurrentObjectUrl() {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
}

// ===========================================
// STICKY PLAYER
// ===========================================
function initStickyPlayer() {
    if (!stickyPlayer) return;
    const playerSection = document.querySelector('.player-section');
    if (!playerSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                stickyPlayer.classList.add('hidden');
            } else if (tracks.length > 0 && !audio.paused) {
                stickyPlayer.classList.remove('hidden');
            }
        });
    }, { threshold: 0.1 });

    observer.observe(playerSection);
    if (miniPlayBtn) miniPlayBtn.addEventListener('click', togglePlay);
}

function updateStickyPlayer(track) {
    if (!stickyPlayer) return;
    if (miniCover) {
        const coverUrl = sanitizeCoverUrl(track.cover);
        if (coverUrl) {
            miniCover.style.backgroundImage = `url(${coverUrl})`;
            miniCover.style.backgroundSize = 'cover';
            miniCover.classList.remove('no-cover');
        } else {
            miniCover.style.backgroundImage = '';
            miniCover.classList.add('no-cover');
        }
    }
    if (miniTitle) miniTitle.textContent = track.name;
    if (miniArtist) miniArtist.textContent = track.artist || 'Арабутка';
}

// ===========================================
// АНИМАЦИЯ ОБЛОЖКИ
// ===========================================
function updateCoverAnimation(isPlaying) {
    if (!coverArt) return;
    if (isPlaying) {
        coverArt.classList.remove('paused');
    } else {
        coverArt.classList.add('paused');
    }
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
        tracks = Array.isArray(data) ? data : data.tracks;
        allTracks = [...tracks];
        applySorting();
        renderTracks();
        if (isShuffled) generateShuffledIndices();
    } catch (err) {
        trackList.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
}

// ===========================================
// СОРТИРОВКА И ФИЛЬТРАЦИЯ
// ===========================================
function applySorting() {
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        tracks = allTracks.filter(t => t.name.toLowerCase().includes(q));
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
        if (searchQuery) {
            trackList.innerHTML = '<div class="empty-state">🔍 Ничего не найдено</div>';
        } else {
            trackList.innerHTML = '<div class="empty-state">🎵 Загрузи свой первый трек!</div>';
        }
        return;
    }

    trackList.innerHTML = tracks.map((track, index) => {
        const isActive = index === currentIndex;
        const isPlaying = isActive && !audio.paused;

        const equalizerHtml = isPlaying ? `<div class="equalizer"><span></span><span></span><span></span></div>` : '';

        return `<div class="track-item ${isActive ? 'active' : ''}" data-swipe-index="${index}" onclick="playTrack(${index})">
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">Арабутка</div>
            </div>
            ${equalizerHtml}
            <button class="delete-btn" onclick="event.stopPropagation(); deleteTrack(${Number(track.id)})">🗑️</button>
        </div>`;
    }).join('');
}

// ===========================================
// ВОСПРОИЗВЕДЕНИЕ
// ===========================================
async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    currentIndex = index;
    const track = tracks[currentIndex];

    try {
        const resp = await fetch(`${API_URL}/stream/${track.id}`, { headers: authHeaders });
        const blob = await resp.blob();

        // Очищаем предыдущий Object URL для предотвращения утечки памяти
        revokeCurrentObjectUrl();
        currentObjectUrl = URL.createObjectURL(blob);
        audio.src = currentObjectUrl;
        audio.play();
    } catch (err) {
        console.error('Ошибка воспроизведения:', err);
    }

    if (trackTitle) trackTitle.textContent = track.name;
    if (trackArtist) trackArtist.textContent = 'Арабутка';
    updatePlayButton(true);
    updateCoverAnimation(true);
    updateStickyPlayer(track);
    renderTracks();

    if (mediaSessionManager) {
        mediaSessionManager.updateMetadata({
            name: track.name,
            artist: 'Arabuthka',
            album: 'Моя музыка'
        });
        mediaSessionManager.updatePlaybackState('playing');
    }
}

function togglePlay() {
    if (!audio.src || tracks.length === 0) {
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
    if (tracks.length === 0) return;
    let nextIndex;

    if (isShuffled && shuffledIndices.length > 0) {
        const pos = shuffledIndices.indexOf(currentIndex);
        const nextPos = (pos + 1) % shuffledIndices.length;
        nextIndex = shuffledIndices[nextPos];
    } else {
        nextIndex = (currentIndex + 1) % tracks.length;
    }

    playTrack(nextIndex);
}

function prevTrack() {
    if (tracks.length === 0) return;

    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    let prevIndex;
    if (isShuffled && shuffledIndices.length > 0) {
        const pos = shuffledIndices.indexOf(currentIndex);
        const prevPos = (pos - 1 + shuffledIndices.length) % shuffledIndices.length;
        prevIndex = shuffledIndices[prevPos];
    } else {
        prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    }

    playTrack(prevIndex);
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
        generateShuffledIndices();
    }
}

function generateShuffledIndices() {
    shuffledIndices = tracks.map((_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }
}

function toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    repeatMode = modes[(idx + 1) % modes.length];
    const btn = document.getElementById('repeatBtn');
    if (btn) {
        btn.classList.toggle('active', repeatMode !== 'none');
        btn.textContent = repeatMode === 'one' ? '🔂' : '🔁';
    }
}

// ===========================================
// ГРОМКОСТЬ И МЬЮТ
// ===========================================
function toggleMute() {
    if (audio.volume > 0) {
        previousVolume = audio.volume;
        audio.volume = 0;
        if (volumeBar) volumeBar.value = 0;
        if (muteBtn) muteBtn.textContent = '🔇';
    } else {
        audio.volume = previousVolume;
        if (volumeBar) volumeBar.value = previousVolume * 100;
        if (muteBtn) muteBtn.textContent = '🔊';
    }
}

// ===========================================
// УТИЛИТЫ
// ===========================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayButton(isPlaying) {
    if (playBtn) playBtn.textContent = isPlaying ? '⏸️' : '▶️';
    if (miniPlayBtn) miniPlayBtn.textContent = isPlaying ? '⏸️' : '▶️';
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
    } else if (repeatMode === 'all' || currentIndex < tracks.length - 1) {
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
if (progressBar) {
    progressBar.addEventListener('input', () => {
        if (!audio.duration) return;
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    });
}

if (volumeBar) {
    volumeBar.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
        if (muteBtn) {
            muteBtn.textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔉' : '🔊';
        }
    });
}

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

const sortByName = document.getElementById('sortByName');
const sortByDate = document.getElementById('sortByDate');

if (sortByName) {
    sortByName.addEventListener('click', () => {
        sortMode = 'name';
        sortByName.classList.add('active');
        if (sortByDate) sortByDate.classList.remove('active');
        applySorting();
        renderTracks();
    });
}

if (sortByDate) {
    sortByDate.addEventListener('click', () => {
        sortMode = 'date';
        sortByDate.classList.add('active');
        if (sortByName) sortByName.classList.remove('active');
        applySorting();
        renderTracks();
    });
}

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

// ===========================================
// ИНИЦИАЛИЗАЦИЯ
// ===========================================
const navHome = document.getElementById('navHome');
const navLibrary = document.getElementById('navLibrary');
const navSearch = document.getElementById('navSearch');
const navProfile = document.getElementById('navProfile');

function setActiveNav(activeBtn) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
}

if (navHome) navHome.addEventListener('click', () => {
    setActiveNav(navHome);
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

if (navLibrary) navLibrary.addEventListener('click', () => {
    setActiveNav(navLibrary);
    const trackSection = document.getElementById('trackList');
    if (trackSection) trackSection.scrollIntoView({ behavior: 'smooth' });
});

if (navSearch) navSearch.addEventListener('click', () => {
    setActiveNav(navSearch);
    const globalSection = document.getElementById('globalSearchSection');
    if (globalSection) {
        globalSection.style.display = 'block';
        globalSection.scrollIntoView({ behavior: 'smooth' });
        const input = document.getElementById('globalSearchInput');
        if (input) setTimeout(() => input.focus(), 400);
    }
});

if (navProfile) navProfile.addEventListener('click', () => {
    setActiveNav(navProfile);
    const user = tg.initDataUnsafe?.user;
    if (user) {
        const name = escapeHtml(`${user.first_name || ''} ${user.last_name || ''}`.trim());
        alert(`👤 ${name}\n🆔 ID: ${user.id}\n📊 Треков: ${tracks.length}`);
    }
});

initStickyPlayer();
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
                    : `<div class="search-result-cover no-cover"></div>`;

                return `<div class="search-result-item">
                    ${coverHtml}
                    <div class="search-result-info">
                        <div class="search-result-title">${title}</div>
                        <div class="search-result-artist">${artist}</div>
                    </div>
                    <button class="search-result-btn play-btn" onclick="playSearchResult(${i})">▶️</button>
                    ${!track.isDownloaded ? `<button class="search-result-btn" onclick="downloadSearchResult(${i})">⬇️</button>` : ''}
                </div>`;
            }).join('');

            window._searchResults = results;
        } catch (err) {
            resultsContainer.innerHTML = `<div class="search-placeholder">Ошибка поиска: ${escapeHtml(err.message)}</div>`;
        }
    }

    searchBtn.addEventListener('click', () => {
        performSearch(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch(searchInput.value);
        }
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(searchInput.value);
        }, 600);
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
        updateStickyPlayer(track);
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
        btn.textContent = '⏳';
        btn.disabled = true;
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
            if (btn) {
                btn.textContent = '✅';
                btn.title = 'Добавлено';
            }
            loadTracks();
        } else {
            if (btn) btn.textContent = '❌';
            console.error('Ошибка скачивания:', data.error);
        }
    } catch (err) {
        if (btn) btn.textContent = '❌';
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
    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
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
        // Ignore vertical scrolling
        if (!isDragging && Math.abs(dy) > Math.abs(dx)) {
            currentEl = null;
            return;
        }
        isDragging = true;
        // Clamp between -120 and 120
        const clampedDx = Math.max(-120, Math.min(120, dx));
        currentEl.style.transform = `translateX(${clampedDx}px)`;
    }, { passive: true });

    trackListEl.addEventListener('touchend', () => {
        if (!currentEl) return;
        const transform = currentEl.style.transform;
        const match = transform.match(/translateX\(([\-\d.]+)px\)/);
        const dx = match ? parseFloat(match[1]) : 0;

        currentEl.classList.remove('swiping');
        currentEl.classList.add('snap-back');

        if (dx > THRESHOLD) {
            // Swipe right => Like / add to favorites
            showToast('\u2764\ufe0f \u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e \u0432 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435');
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        } else if (dx < -THRESHOLD) {
            // Swipe left => Delete
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
                        showToast(`\ud83d\udc64 ${user.first_name || ''} \u2022 ${tracks.length} \u0442\u0440\u0435\u043a\u043e\u0432`);
                    }
                    break;
            }

            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });
    });
})();
