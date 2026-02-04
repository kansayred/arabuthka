const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_URL = 'https://arabuthka-production.up.railway.app';

// Получаем initData для авторизации
const initData = tg.initData;
const userId = tg.initDataUnsafe?.user?.id;

if (!userId) {
  document.body.innerHTML = '<div style="padding:20px;text-align:center;">❌ Откройте через Telegram</div>';
  throw new Error('No user_id');
}

// Заголовки с авторизацией для всех запросов
const authHeaders = {
  'X-Telegram-Init-Data': initData
};

const audio = document.getElementById('audio');
const trackName = document.getElementById('trackName');
const trackList = document.getElementById('trackList');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

let tracks = [];
let currentIndex = 0;
let isShuffled = false;
let repeatMode = 'none'; // 'none', 'one', 'all'
let shuffledIndices = [];

// Загрузка трека
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
    } else {
      uploadStatus.textContent = 'Ошибка: ' + (data.error || 'Unknown');
    }
  } catch (err) {
    uploadStatus.textContent = 'Ошибка загрузки';
  }
  fileInput.value = '';
});

// Загрузка списка треков
async function loadTracks() {
  try {
    const res = await fetch(`${API_URL}/tracks`, {
      headers: authHeaders
    });
    tracks = await res.json();
    renderTracks();
    if (isShuffled) generateShuffledIndices();
  } catch (err) {
    console.error('Ошибка загрузки треков:', err);
  }
}

function renderTracks() {
  trackList.innerHTML = '';
  tracks.forEach((track, index) => {
    const div = document.createElement('div');
    div.className = 'track-item' + (index === currentIndex ? ' active' : '');
    div.innerHTML = `
      <span onclick="playTrack(${index})">🎵 ${track.name}</span>
      <button onclick="deleteTrack(${track.id})">🗑</button>
    `;
    trackList.appendChild(div);
  });
}

function playTrack(index) {
  if (tracks.length === 0) return;
  currentIndex = index;
  const track = tracks[currentIndex];
  audio.src = track.url;
  audio.play();
  trackName.textContent = track.name;
  renderTracks();
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

// Навигация
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

// Shuffle
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

// Repeat
function toggleRepeat() {
  const modes = ['none', 'one', 'all'];
  const idx = modes.indexOf(repeatMode);
  repeatMode = modes[(idx + 1) % 3];
  const btn = document.getElementById('repeatBtn');
  btn.textContent = repeatMode === 'one' ? '🔂' : '🔁';
  btn.classList.toggle('active', repeatMode !== 'none');
}

// Обработка окончания трека
audio.addEventListener('ended', () => {
  if (repeatMode === 'one') {
    audio.currentTime = 0;
    audio.play();
  } else if (repeatMode === 'all' || currentIndex < tracks.length - 1) {
    nextTrack();
  }
});

// Инициализация
loadTracks();
