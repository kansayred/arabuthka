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

// DOM элементы
const audio = document.getElementById('audio');
const trackName = document.getElementById('trackName');
const trackList = document.getElementById('trackList');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeBar = document.getElementById('volumeBar');
const playBtn = document.getElementById('playBtn');
const muteBtn = document.getElementById('muteBtn');

let tracks = [];
let currentIndex = 0;
let isShuffled = false;
let repeatMode = 'none';
let shuffledIndices = [];
let previousVolume = 1;

// Переменные для поиска и сортировки
let searchQuery = ''; // Текущий запрос поиска
let sortMode = 'date'; // Режим сортировки: 'date' или 'name'
let allTracks = []; // Полный список треков (для поиска)

// =============================================
// ЗАГРУЗКА ТРЕКОВ
// =============================================

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

async function loadTracks() {
  try {
    const res = await fetch(`${API_URL}/tracks`, {
      headers: authHeaders
    });
    tracks = await res.json();
        allTracks = tracks; // Сохраняем полный список для поиска
    renderTracks();
    if (isShuffled) generateShuffledIndices();
  } catch (err) {
    console.error('Ошибка загрузки треков:', err);
  }
}

function renderTracks() {
  trackList.innerHTML = '';
  if (tracks.length === 0) {
    trackList.innerHTML = '<p>Нет треков. Загрузи первый!</p>';
    return;
  }
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

// =============================================
// ВОСПРОИЗВЕДЕНИЕ
// =============================================

function playTrack(index) {
  if (tracks.length === 0) return;
  currentIndex = index;
  const track = tracks[currentIndex];
  audio.src = track.url;
  audio.play();
  trackName.textContent = track.name;
  playBtn.textContent = '⏸️';
  renderTracks();
}

function togglePlay() {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = '⏸️';
  } else {
    audio.pause();
    playBtn.textContent = '▶️';
  }
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
  }
});

audio.addEventListener('play', () => {
  playBtn.textContent = '⏸️';
});

audio.addEventListener('pause', () => {
  playBtn.textContent = '▶️';
});

// =============================================

// =============================================
// ПОИСК И СОРТИРОВКА
// =============================================

// Получаем DOM элементы поиска и сортировки
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const sortByNameBtn = document.getElementById('sortByName');
const sortByDateBtn = document.getElementById('sortByDate');

// Функция поиска треков по названию
function searchTracks(query) {
  searchQuery = query.toLowerCase().trim();
  
  // Если поиск пустой - показываем все треки
  if (!searchQuery) {
    tracks = [...allTracks];
    clearSearchBtn.style.display = 'none';
  } else {
    // Фильтруем треки по имени
    tracks = allTracks.filter(track => 
      track.name.toLowerCase().includes(searchQuery)
    );
    clearSearchBtn.style.display = 'block';
  }
  
  // Применяем текущую сортировку
  applySorting();
  renderTracks();
}

// Функция сортировки треков
function applySorting() {
  if (sortMode === 'name') {
    // Сортируем по алфавиту (А-Я)
    tracks.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } else {
    // Сортируем по дате (новые сверху)
    tracks.sort((a, b) => b.id - a.id);
  }
}

// Очистка поиска
function clearSearch() {
  searchInput.value = '';
  searchTracks('');
}

// Переключение сортировки по имени
function sortByName() {
  sortMode = 'name';
  sortByNameBtn.classList.add('active');
  sortByDateBtn.classList.remove('active');
  applySorting();
  renderTracks();
}

// Переключение сортировки по дате
function sortByDate() {
  sortMode = 'date';
  sortByDateBtn.classList.add('active');
  sortByNameBtn.classList.remove('active');
  applySorting();
  renderTracks();
}

// Слушатели событий поиска и сортировки
searchInput.addEventListener('input', (e) => searchTracks(e.target.value));
clearSearchBtn.addEventListener('click', clearSearch);
sortByNameBtn.addEventListener('click', sortByName);
sortByDateBtn.addEventListener('click', sortByDate);
// ИНИЦИАЛИЗАЦИЯ
// =============================================

loadTracks();
