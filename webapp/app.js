const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_URL = 'https://arabuthka-production.up.railway.app';

const audio = document.getElementById('audio');
const trackName = document.getElementById('trackName');
const trackList = document.getElementById('trackList');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

let tracks = [];
let currentIndex = 0;

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
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      uploadStatus.textContent = '✅ Загружено!';
      loadTracks();
    }
  } catch (err) {
    uploadStatus.textContent = '❌ Ошибка';
  }
});

// Загрузить список треков
async function loadTracks() {
  try {
    const res = await fetch(`${API_URL}/tracks`);
    tracks = await res.json();

    trackList.innerHTML = '';
    tracks.forEach((track, index) => {
      const div = document.createElement('div');
      div.className = 'track-item';
      
      const name = document.createElement('span');
      name.textContent = `🎵 ${track.name}`;
      name.onclick = () => playTrack(index);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '✕';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteTrack(track.id, index);
      };
      
      div.appendChild(name);
      div.appendChild(deleteBtn);
      trackList.appendChild(div);
    });
  } catch (err) {
    trackList.innerHTML = '<div class="track-item">Нет треков</div>';
  }
}

// Воспроизвести трек
function playTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  
  currentIndex = index;
  const track = tracks[index];
  trackName.textContent = track.name;
  audio.src = track.url;
  audio.play();
  
  highlightCurrentTrack();
}

// Подсветить текущий трек
function highlightCurrentTrack() {
  const items = document.querySelectorAll('.track-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === currentIndex);
  });
}

// Следующий трек
function nextTrack() {
  if (currentIndex < tracks.length - 1) {
    playTrack(currentIndex + 1);
  }
}

// Предыдущий трек
function prevTrack() {
  if (currentIndex > 0) {
    playTrack(currentIndex - 1);
  }
}

// Удалить трек
async function deleteTrack(id, index) {
  if (!confirm('Удалить трек?')) return;
  
  try {
    const res = await fetch(`${API_URL}/tracks/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    
    if (data.success) {
      if (index === currentIndex) {
        audio.pause();
        audio.src = '';
        trackName.textContent = 'Выбери трек';
      } else if (index < currentIndex) {
        currentIndex--;
      }
      loadTracks();
    }
  } catch (err) {
    alert('Ошибка удаления');
  }
}

// Автопереход на следующий трек
audio.addEventListener('ended', () => {
  nextTrack();
});

// Кнопки управления
document.getElementById('prevBtn').addEventListener('click', prevTrack);
document.getElementById('nextBtn').addEventListener('click', nextTrack);

// Загрузить треки при старте
loadTracks();