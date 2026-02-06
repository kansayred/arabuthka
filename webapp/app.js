// Арабутка — Театральный редизайн
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Media Session API
import { MediaSessionManager } from './mediaSession.js';

const API_URL = 'https://arabuthka-production.up.railway.app';

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
        if (track.cover) {
            miniCover.style.backgroundImage = `url(${track.cover})`;
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
                trackList.innerHTML = '<p>⚠️ Откройте через Telegram</p>';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }
        tracks = await res.json();
        allTracks = [...tracks];
        applySorting();
        renderTracks();
        if (isShuffled) generateShuffledIndices();
    } catch (err) {
        trackList.innerHTML = `<p>❌ ${err.message}</p>`;
    }
}

// ===========================================
// СОРТИРОВКА И ФИЛЬТРАЦИЯ
// ===========================================
function applySorting() {
    // Сначала фильтруем по поисковому запросу
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        tracks = allTracks.filter(t => t.name.toLowerCase().includes(q));
    } else {
        tracks = [...allTracks];
    }

    // Затем сортируем
    if (sortMode === 'name') {
        tracks.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    } else {
        // По дате — новые сверху
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
            trackList.innerHTML = '<p>🔍 Ничего не найдено</p>';
        } else {
            trackList.innerHTML = '<p>🎵 Загрузи свой первый трек!</p>';
        }
        return;
    }

    trackList.innerHTML = tracks.map((track, index) => {
        const isActive = index === currentIndex;
        const isPlaying = isActive && !audio.paused;

        // Эквалайзер-анимация для играющего трека
        const equalizerHtml = isPlaying ? `
            <div class="equalizer">
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
            </div>` : '';

        return `
            <div class="track-item ${isActive ? 'active' : ''}" onclick="playTrack(${index})">
                <div class="track-number">${index + 1}</div>
                <div class="track-cover no-cover"></div>
                <div class="track-info-item">
                    <div class="track-name">${escapeHtml(track.name)}</div>
                    <div class="track-artist-small">Арабутка</div>
                </div>
                ${equalizerHtml}
                <button class="track-delete" onclick="event.stopPropagation(); deleteTrack(${track.id})">🗑️</button>
            </div>
        `;
    }).join('');
}

// ===========================================
// ВОСПРОИЗВЕДЕНИЕ
// ===========================================
function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;

    currentIndex = index;
    const track = tracks[currentIndex];

    audio.src = track.url;
    audio.play().catch(err => console.log('Ошибка воспроизведения:', err));

    // Обновляем основной плеер
    if (trackTitle) trackTitle.textContent = track.name;
    if (trackArtist) trackArtist.textContent = 'Арабутка';

    updatePlayButton(true);
    updateCoverAnimation(true);
    updateStickyPlayer(track);
    renderTracks();

    // Обновляем метаданные для экрана блокировки
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
        // Если ничего не выбрано — начинаем с первого трека
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

    // Если прошло больше 3 секунд — перематываем в начало текущего трека
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
    // Алгоритм Фишера-Йейтса для честного перемешивания
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
        // Разные иконки для разных режимов повтора
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

// Защита от XSS при вставке пользовательских данных в HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        // Повтор одного трека — перемотать и играть заново
        audio.currentTime = 0;
        audio.play();
    } else if (repeatMode === 'all' || currentIndex < tracks.length - 1) {
        // Повтор всех или есть ещё треки — переключить на следующий
        nextTrack();
    } else {
        // Плейлист кончился — остановить
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

// ===========================================
// ОБРАБОТЧИКИ UI-ЭЛЕМЕНТОВ
// ===========================================

// Перемотка через прогресс-бар
if (progressBar) {
    progressBar.addEventListener('input', () => {
        if (!audio.duration) return;
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    });
}

// Регулировка громкости
if (volumeBar) {
    volumeBar.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
        if (muteBtn) {
            muteBtn.textContent = audio.volume === 0 ? '🔇' :
                                  audio.volume < 0.5 ? '🔉' : '🔊';
        }
    });
}

// Живой поиск по названию
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

// Кнопки сортировки
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
// Нужен потому что app.js подключён как ES-модуль
// (type="module"), а onclick в HTML не видит
// функции из модуля — они живут в своём scope.
// Поэтому вешаем их на window вручную.
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
initStickyPlayer();
loadTracks();
