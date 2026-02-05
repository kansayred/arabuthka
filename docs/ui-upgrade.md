# UI/UX Upgrade v2.0

Обновление интерфейса Arabuthka до современного уровня.

## Что изменилось

### Плеер
- Крупная обложка трека с анимацией вращения
- Увеличенная кнопка Play (70px)
- Плавные анимации переключения
- Бегущая строка для длинных названий

### Список треков
- Номера треков вместо эмодзи
- Анимация эквалайзера у активного трека
- Плавное появление при загрузке

### Общее
- Sticky-плеер внизу экрана
- Улучшенные анимации
- Адаптация под мобильные

---

## Как применить

1. Сделай `git pull` в корне проекта
2. Скопируй содержимое **style.css** ниже в `webapp/style.css`
3. Скопируй содержимое **index.html** ниже в `webapp/index.html`
4. Проверь в Telegram Mini App
5. Если всё ок — закоммить и запушить

---

## style.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #667eea;
  --primary-dark: #764ba2;
  --bg-dark: #0d1117;
  --bg-card: rgba(255,255,255,0.05);
  --text: #ffffff;
  --text-muted: #8b949e;
  --border: rgba(255,255,255,0.1);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(180deg, #1a1a2e 0%, #0d1117 100%);
  color: var(--text);
  min-height: 100vh;
  padding: 15px;
  padding-bottom: 200px;
}

.container {
  max-width: 500px;
  margin: 0 auto;
}

/* ========== ЗАГОЛОВОК ========== */
h1 {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ========== ЗАГРУЗКА ========== */
.upload-section {
  background: var(--bg-card);
  padding: 15px;
  border-radius: 16px;
  margin-bottom: 15px;
  text-align: center;
  border: 1px solid var(--border);
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  padding: 12px 24px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
}

.upload-btn:active {
  transform: scale(0.95);
}

#uploadStatus {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  color: var(--primary);
}

/* ========== ПОИСК ========== */
.search-section {
  background: var(--bg-card);
  padding: 15px;
  border-radius: 16px;
  margin-bottom: 15px;
  border: 1px solid var(--border);
}

.search-box {
  position: relative;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0.5;
}

#searchInput {
  width: 100%;
  padding: 12px 40px;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: white;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

#searchInput:focus {
  border-color: var(--primary);
  background: rgba(255,255,255,0.12);
}

#searchInput::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,100,100,0.3);
  border: none;
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: none;
}

.sort-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.sort-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.sort-btn.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border-color: var(--primary);
}

/* ========== ПЛЕЕР ========== */
.player {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 20px;
  margin-bottom: 15px;
  border: 1px solid var(--border);
  position: sticky;
  bottom: 15px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Обложка трека */
.album-art {
  width: 120px;
  height: 120px;
  margin: 0 auto 15px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50px;
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);
  transition: transform 0.3s;
}

.album-art.playing {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.track-info {
  text-align: center;
  margin-bottom: 15px;
}

#trackName {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Прогресс-бар */
.progress-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 15px 0;
}

#currentTime, #duration {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 35px;
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px var(--primary);
}

.progress-bar::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* Кнопки управления */
.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin: 15px 0;
}

.controls button {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.controls button:active {
  transform: scale(0.9);
}

.controls button.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
}

#playBtn {
  width: 70px;
  height: 70px;
  font-size: 28px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

#playBtn:active {
  transform: scale(0.95);
}

/* Громкость */
.volume-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

#muteBtn {
  background: transparent;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
}

.volume-bar {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.volume-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

.volume-bar::-moz-range-thumb {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

audio {
  display: none;
}

/* Sticky-плеер внизу экрана */
.sticky-player {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, transparent, var(--bg-dark) 20%);
    padding: 15px 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    z-index: 100;
    backdrop-filter: blur(10px);
}

.sticky-player.hidden {
    transform: translateY(100%);
}

.mini-cover {
    width: 45px;
    height: 45px;
    border-radius: 8px;
    object-fit: cover;
}

.mini-info {
    flex: 1;
    min-width: 0;
}

.mini-title {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mini-artist {
    font-size: 11px;
    color: var(--text-secondary);
}

.mini-controls {
    display: flex;
    gap: 10px;
}

.mini-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--primary);
    color: white;
    cursor: pointer;
}

/* Анимации */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.fade-in {
    animation: fadeIn 0.3s ease-out;
}

.cover-spinning {
    animation: spin 8s linear infinite;
}

.cover-spinning.paused {
    animation-play-state: paused;
}

/* Эквалайзер */
.equalizer {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
    margin-left: auto;
}

.equalizer-bar {
    width: 3px;
    background: var(--primary);
    border-radius: 2px;
    animation: equalize 0.5s ease-in-out infinite alternate;
}

.equalizer-bar:nth-child(1) { animation-delay: 0s; height: 8px; }
.equalizer-bar:nth-child(2) { animation-delay: 0.1s; height: 12px; }
.equalizer-bar:nth-child(3) { animation-delay: 0.2s; height: 6px; }
.equalizer-bar:nth-child(4) { animation-delay: 0.3s; height: 14px; }

@keyframes equalize {
    to { height: 16px; }
}

/* Мобильная адаптация */
@media (max-width: 480px) {
    .container {
        padding: 15px;
    }
    
    .player-section {
        padding: 20px;
    }
    
    .cover-art {
        width: 180px;
        height: 180px;
    }
    
    .track-title {
        font-size: 18px;
    }
    
    #playBtn {
        width: 56px;
        height: 56px;
        font-size: 20px;
    }
    
    .control-btn {
        font-size: 18px;
    }
    
    .track-item {
        padding: 10px;
    }
    
    .track-cover {
        width: 40px;
        height: 40px;
    }
}

/* Бегущая строка для длинных названий */
.marquee-container {
    overflow: hidden;
    white-space: nowrap;
}

.marquee-text {
    display: inline-block;
    animation: marquee 10s linear infinite;
}

@keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
```

---

## index.html

Новый HTML с улучшенным UI:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Арабутка</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
    <div class="container fade-in">
        <!-- Сортировка -->
        <div class="sort-buttons">
            <button class="sort-btn active" data-sort="recent">Новые</button>
            <button class="sort-btn" data-sort="popular">Популярные</button>
            <button class="sort-btn" data-sort="alpha">А-Я</button>
        </div>

        <!-- Главный плеер -->
        <section class="player-section">
            <img id="coverArt" class="cover-art cover-spinning paused" src="" alt="Обложка">
            
            <div class="track-info">
                <div class="marquee-container">
                    <span id="trackTitle" class="track-title marquee-text">Выбери трек</span>
                </div>
                <span id="trackArtist" class="track-artist">Арабутка</span>
            </div>

            <!-- Прогресс-бар -->
            <div class="progress-container">
                <span id="currentTime" class="time">0:00</span>
                <input type="range" id="progressBar" class="progress-bar" value="0" min="0" max="100">
                <span id="duration" class="time">0:00</span>
            </div>

            <!-- Управление -->
            <div class="controls">
                <button id="shuffleBtn" class="control-btn" title="Перемешать">🔀</button>
                <button id="prevBtn" class="control-btn" title="Назад">⏮️</button>
                <button id="playBtn" title="Воспроизвести">▶️</button>
                <button id="nextBtn" class="control-btn" title="Вперёд">⏭️</button>
                <button id="repeatBtn" class="control-btn" title="Повтор">🔁</button>
            </div>

            <!-- Громкость -->
            <div class="volume-container">
                <button id="muteBtn">🔊</button>
                <input type="range" id="volumeBar" class="volume-bar" value="100" min="0" max="100">
            </div>
        </section>

        <!-- Список треков -->
        <section class="track-list" id="trackList">
            <!-- Треки загружаются через JS -->
        </section>

        <audio id="audioPlayer"></audio>
    </div>

    <!-- Sticky-плеер для скролла -->
    <div class="sticky-player hidden" id="stickyPlayer">
        <img class="mini-cover" id="miniCover" src="" alt="">
        <div class="mini-info">
            <div class="mini-title" id="miniTitle"></div>
            <div class="mini-artist" id="miniArtist"></div>
        </div>
        <div class="mini-controls">
            <button class="mini-btn" id="miniPlayBtn">▶️</button>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

---

## Заметки

- **Обложка**: Добавлена анимация вращения при воспроизведении
- **Кнопка Play**: Увеличена до 70px с градиентом
- **Список треков**: Номера вместо эмодзи, эквалайзер для активного трека
- **Sticky-плеер**: Появляется при скролле вниз
- **Адаптивность**: Оптимизация для мобильных (480px)
