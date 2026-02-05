const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Media Session API
import { MediaSessionManager } from './mediaSession.js';

const API_URL = 'https://arabuthka-production.up.railway.app';

// Получаем initData для авторизации
const initData = tg.initData;
const userId = tg.initDataUnsafe?.user?.id;

if (!userId) {
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">❌ Откройте через Telegram</div>';
    throw new Error('No user_id');
}

// Заголовки с авторизацией
const authHeaders = {
    'X-Telegram-Init-Data': initData
};

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

// Sticky Player элементы
const stickyPlayer = document.getElementById('stickyPlayer');
const miniCover = document.getElementById('miniCover');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniPlayBtn = document.getElementById('miniPlayBtn');

// Media Session Manager
let mediaSessionManager = null;

if (MediaSessionManager.isSupported()) {
    mediaSessionManager = new MediaSessionManager(audio);
    mediaSessionManager.onPrevious(prevTrack);
    mediaSessionManager.onNext(nextTrack);
    console.log('✅ Media Session initialized');
}

let tracks = [];
let currentIndex = 0;
let isShuffled = false;
let repeatMode = 'none';
let shuffledIndices = [];
let previousVolume = 1;
let searchQuery = '';
let sortMode = 'date';
let allTracks = [];

// =============================================
// STICKY PLAYER (появляется при скролле)
// =============================================
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
    
    // Клик по mini play кнопке
    if (miniPlayBtn) {
        miniPlayBtn.addEventListener('click', togglePlay);
    }
}

// Обновление sticky player
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

// =============================================
// АНИМАЦИЯ ОБЛОЖКИ (вращение при воспроизведении)
// =============================================
function updateCoverAnimation(isPlaying) {
    if (!coverArt) return;
    
    if (isPlaying) {
        coverArt.classList.remove('paused');
    } else {
        coverArt.classList.add('paused');
    }
}

// =============================================
// БЕГУЩАЯ СТРОКА для длинных названий
// =============================================
function checkMarquee() {
    const marqueeContainer = document.querySelector('.marquee-container');
    const marqueeText = document.querySelector('.marquee-text');
    
    if (!marqueeContainer || !marqueeText) return;
    
    // Если текст длиннее контейнера — включаем анимацию
    if (marqueeText.scrollWidth > marqueeContainer.offsetWidth) {
        marqueeText.style.animation = 'marquee 10s linear infinite';
    } else {
        marqueeText.style.animation = 'none';
    }
}

// =============================================
// ЗАГРУЗКА ТРЕКОВ
// =============================================
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
                uploadStatus.textContent = 'Ошибка: ' + (data.error || 'Unknown');
            }
        } catch (err) {
            uploadStatus.textContent = 'Ошибка загрузки';
        }
        fileInput.value = '';
    });
}

async function loadTracks() {
    try {
        const res = await fetch(`${API_URL}/tracks`, {
            headers: authHeaders
        });
        
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
        console.error('Ошибка загрузки:', err);
        trackList.innerHTML = `<p>❌ ${err.message}</p>`;
    }
}

// =============================================
// РЕНДЕР ТРЕКОВ (с номерами и эквалайзером)
// =============================================
function renderTracks() {
    trackList.innerHTML = '';
    
    if (tracks.length === 0) {
        trackList.innerHTML = '<p>Нет треков. Загрузи первый!</p>';
        return;
    }
    
    tracks.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = 'track-item fade-in' + (index === currentIndex ? ' active' : '');
        
        // Эквалайзер для активного трека
        const equalizerHTML = index === currentIndex && !audio.paused ? `
            <div class="equalizer">
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
            </div>
        ` : '';
        
        // Обложка — div с фоном или заглушка
        const coverStyle = track.cover 
            ? `style="background-image: url(${track.cover}); background-size: cover;"` 
            : '';
        const coverClass = track.cover ? 'track-cover' : 'track-cover no-cover';
        
        div.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="${coverClass}" ${coverStyle}></div>
            <div class="track-info-item" onclick="playTrack(${index})">
                <div class="track-name">${track.name}</div>
                <div class="track-artist-small">${track.artist || ''}</div>
            </div>
            ${equalizerHTML}
            <button class="track-delete" onclick="deleteTrack(${track.id})">🗑</button>
        `;
        
        trackList.appendChild(div);
    });
}

// =============================================
// ВОСПРОИЗВЕДЕНИЕ
// =============================================
function playTrack(index) {
    if (tracks.length === 0) return;
    
    currentIndex = index;
    const track = tracks[currentIndex];
    
    audio.src = track.url;
    audio.play();
    
    // Обновляем UI
    if (trackTitle) trackTitle.textContent = track.name;
    if (trackArtist) trackArtist.textContent = track.artist || 'Арабутка';
    
    // Обложка — если есть url, показываем картинку, иначе заглушку
    if (coverArt) {
        if (track.cover) {
            coverArt.style.backgroundImage = `url(${track.cover})`;
            coverArt.style.backgroundSize = 'cover';
            coverArt.classList.remove('no-cover');
        } else {
            coverArt.style.backgroundImage = '';
            coverArt.classList.add('no-cover');
        }
    }
    
    playBtn.textContent = '⏸️';
    updateCoverAnimation(true);
    updateStickyPlayer(track);
    checkMarquee();
    renderTracks();
    
    if (mediaSessionManager) {
        mediaSessionManager.updateMetadata(track);
    }
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
        playBtn.textContent = '⏸️';
        if (miniPlayBtn) miniPlayBtn.textContent = '⏸️';
        updateCoverAnimation(true);
        if (mediaSessionManager) mediaSessionManager.updatePlaybackState('playing');
    } else {
        audio.pause();
        playBtn.textContent = '▶️';
        if (miniPlayBtn) miniPlayBtn.textContent = '▶️';
        updateCoverAnimation(false);
        if (mediaSessionManager) mediaSessionManager.updatePlaybackState('paused');
    }
    renderTracks(); // Обновляем эквалайзер
}

async function deleteTrack(id) {
    if (!confirm('Удалить трек?')) return;
    try {
        await fetch(`${API_URL}/tracks/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        loadTracks();
    } catch (err) {
        console.error('Ошибка удаления:', err);
    }
}

// =============================================
// НАВИГАЦИЯ
// =============================================
function prevTrack() {
    if (tracks.length === 0) return;
    if (isShuffled) {
        const pos = shuffledIndices.indexOf(currentIndex);
        const newPos = pos > 0 ? pos - 1 : shuffledIndices.length - 1;
        playTrack(shuffledIndices[newPos]);
    } else {
        playTrack(currentIndex > 0 ? currentIndex - 1 : tracks.length - 1);
    }
}

function nextTrack() {
    if (tracks.length === 0) return;
    if (isShuffled) {
        const pos = shuffledIndices.indexOf(currentIndex);
        const newPos = pos < shuffledIndices.length - 1 ? pos + 1 : 0;
        playTrack(shuffledIndices[newPos]);
    } else {
        playTrack(currentIndex < tracks.length - 1 ? currentIndex + 1 : 0);
    }
}

// =============================================
// SHUFFLE & REPEAT
// =============================================
function generateShuffledIndices() {
    shuffledIndices = [...Array(tracks.length).keys()];
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    const btn = document.getElementById('shuffleBtn');
    btn.classList.toggle('active', isShuffled);
    if (isShuffled) generateShuffledIndices();
}

function toggleRepeat() {
    const modes = ['none', 'one', 'all'];
    const idx = modes.indexOf(repeatMode);
    repeatMode = modes[(idx + 1) % 3];
    const btn = document.getElementById('repeatBtn');
    btn.textContent = repeatMode === 'one' ? '🔂' : '🔁';
    btn.classList.toggle('active', repeatMode !== 'none');
}

// =============================================
// ПРОГРЕСС-БАР И ВРЕМЯ
// =============================================
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.value = percent;
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
});

audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
    progressBar.value = 0;
});

progressBar.addEventListener('input', () => {
    if (audio.duration) {
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
});

// =============================================
// ГРОМКОСТЬ
// =============================================
volumeBar.addEventListener('input', () => {
    audio.volume = volumeBar.value / 100;
    updateMuteIcon();
});

function toggleMute() {
    if (audio.volume > 0) {
        previousVolume = audio.volume;
        audio.volume = 0;
        volumeBar.value = 0;
    } else {
        audio.volume = previousVolume;
        volumeBar.value = previousVolume * 100;
    }
    updateMuteIcon();
}

function updateMuteIcon() {
    if (audio.volume === 0) {
        muteBtn.textContent = '🔇';
    } else if (audio.volume < 0.5) {
        muteBtn.textContent = '🔉';
    } else {
        muteBtn.textContent = '🔊';
    }
}

// =============================================
// СОБЫТИЯ AUDIO
// =============================================
audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
    } else if (repeatMode === 'all' || currentIndex < tracks.length - 1) {
        nextTrack();
    } else {
        playBtn.textContent = '▶️';
        if (miniPlayBtn) miniPlayBtn.textContent = '▶️';
        updateCoverAnimation(false);
    }
});

audio.addEventListener('play', () => {
    playBtn.textContent = '⏸️';
    if (miniPlayBtn) miniPlayBtn.textContent = '⏸️';
    updateCoverAnimation(true);
    renderTracks();
});

audio.addEventListener('pause', () => {
    playBtn.textContent = '▶️';
    if (miniPlayBtn) miniPlayBtn.textContent = '▶️';
    updateCoverAnimation(false);
    renderTracks();
});

// =============================================
// ПОИСК И СОРТИРОВКА
// =============================================
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const sortByNameBtn = document.getElementById('sortByName');
const sortByDateBtn = document.getElementById('sortByDate');

function searchTracks(query) {
    searchQuery = query.toLowerCase().trim();
    
    if (!searchQuery) {
        tracks = [...allTracks];
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    } else {
        tracks = allTracks.filter(track => 
            track.name.toLowerCase().includes(searchQuery)
        );
        if (clearSearchBtn) clearSearchBtn.style.display = 'block';
    }
    
    applySorting();
    renderTracks();
}

function applySorting() {
    if (sortMode === 'name') {
        tracks.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    } else {
        tracks.sort((a, b) => b.id - a.id);
    }
}

function clearSearch() {
    if (searchInput) searchInput.value = '';
    searchTracks('');
}

function sortByName() {
    sortMode = 'name';
    if (sortByNameBtn) sortByNameBtn.classList.add('active');
    if (sortByDateBtn) sortByDateBtn.classList.remove('active');
    applySorting();
    renderTracks();
}

function sortByDate() {
    sortMode = 'date';
    if (sortByDateBtn) sortByDateBtn.classList.add('active');
    if (sortByNameBtn) sortByNameBtn.classList.remove('active');
    applySorting();
    renderTracks();
}

// Слушатели поиска и сортировки
if (searchInput) searchInput.addEventListener('input', (e) => searchTracks(e.target.value));
if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);
if (sortByNameBtn) sortByNameBtn.addEventListener('click', sortByName);
if (sortByDateBtn) sortByDateBtn.addEventListener('click', sortByDate);

// =============================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================
loadTracks();
initStickyPlayer();

// =============================================
// ЭКСПОРТ ФУНКЦИЙ В WINDOW
// =============================================
window.playTrack = playTrack;
window.togglePlay = togglePlay;
window.prevTrack = prevTrack;
window.nextTrack = nextTrack;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.toggleMute = toggleMute;
window.deleteTrack = deleteTrack;
window.sortByName = sortByName;
window.sortByDate = sortByDate;
window.clearSearch = clearSearch;
