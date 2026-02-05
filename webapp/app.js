// Арабутка - Театральный редизайн
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

// Состояние
let tracks = [];
let currentIndex = 0;
let isShuffled = false;
let repeatMode = 'none';
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
// АНИМАЦИИ
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
// ЗАГРУЗКА ТРЕКОВ
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
