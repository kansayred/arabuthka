const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_URL = 'https://arabuthka-production.up.railway.app';

// Получаем user_id из Telegram
const userId = tg.initDataUnsafe?.user?.id;

if (!userId) {
  document.body.innerHTML = '<div style="padding:20px;text-align:center;">❌ Откройте через Telegram</div>';
  throw new Error('No user_id');
}

const audio = document.getElementById('audio');
const trackName = document.getElementById('trackName');
const trackList = document.getElementById('trackList');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

let tracks = [];
let currentIndex = 0;

// Загрузка трека (с user_id)
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  uploadStatus.textContent = 'Загрузка...';

  const formData = new FormData();
  formData.append('track', file);
  formData.append('user_id', userId);

  try {
    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      uploadStatus.textContent = '✅ Загружено!';
      loadTracks();
    } else {
      uploadStatus.textContent = '❌ ' + (data.error || 'Ошибка');
    }
  } catch (err) {
    uploadStatus.textContent = '❌ Ошибка сети';
  }
});

// Загрузить треки пользователя
async function loadTracks() {
  try {
    const res = await fetch(`${API_URL}/tracks?user_id=${userId}`);
    tracks = await res.json();

    trackList.innerHTML = '';

    if (tracks.length === 0) {
      trackList.innerHTML = '<div class="track-item">🎵 Загрузите свой первый трек</div>';
      return;
    }

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
    trackList.innerHTML = '<div class="track-item">❌ Ошибка загрузки</div>';
  }
}

function playTrack(index) {
  if (index < 0 || index >= tracks.length) return;

  currentIndex = index;
  const track = tracks[index];
  trackName.textContent = track.name;
  audio.src = track.url;
  audio.play();

  highlightCurrentTrack();
}

function highlightCurrentTrack() {
  const items = document.querySelectorAll('.track-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === currentIndex);
  });
}

function nextTrack() {
  if (currentIndex < tracks.length - 1) {
    playTrack(currentIndex + 1);
  }
}

function prevTrack() {
  if (currentIndex > 0) {
    playTrack(currentIndex - 1);
  }
}

// Удаление с проверкой user_id
async function deleteTrack(id, index) {
  if (!confirm('Удалить трек?')) return;

  try {
    const res = await fetch(`${API_URL}/tracks/${id}?user_id=${userId}`, {
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
    } else {
      alert(data.error || 'Ошибка удаления');
    }
  } catch (err) {
    alert('Ошибка сети');
  }
}

audio.addEventListener('ended', () => {
  nextTrack();
});

document.getElementById('prevBtn').addEventListener('click', prevTrack);
document.getElementById('nextBtn').addEventListener('click', nextTrack);

loadTracks();