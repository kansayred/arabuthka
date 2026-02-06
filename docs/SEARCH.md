# 🔍 Поиск и скачивание музыки в Arabuthka

## Обзор

Arabuthka теперь поддерживает **глобальный поиск музыки** через внешние источники (iTunes, Deezer) с возможностью скачивания треков прямо в приложении.

### Ключевые возможности

✅ Поиск по миллионам треков из iTunes и Deezer  
✅ Объединенный поиск: ваши треки + доступные для скачивания  
✅ Скачивание превью (30 сек) и добавление в библиотеку  
✅ Автоматическая загрузка в Cloudinary  
✅ Без необходимости скачивать файлы на устройство  

---

## API Эндпоинты

### 1. Объединенный поиск

**GET** `/search/all?q={query}&limit={limit}`

Поиск одновременно в вашей библиотеке и внешних источниках.

#### Параметры запроса:
- `q` (обязательный) - поисковый запрос
- `limit` (опционально) - количество результатов (по умолчанию 20)

#### Пример запроса:
```bash
GET /search/all?q=Eminem&limit=10
Headers:
  X-Telegram-Init-Data: <init_data>
```

#### Пример ответа:
```json
{
  "success": true,
  "query": "Eminem",
  "count": 10,
  "tracks": [
    {
      "id": 123,
      "title": "Lose Yourself",
      "artist": "Моя библиотека",
      "url": "https://res.cloudinary.com/...",
      "isDownloaded": true,
      "source": "my_library",
      "created_at": "2026-02-06T10:00:00Z"
    },
    {
      "id": 456789,
      "title": "Without Me",
      "artist": "Eminem",
      "album": "The Eminem Show",
      "duration": 290,
      "artwork": "https://is1-ssl.mzstatic.com/...",
      "previewUrl": "https://audio-ssl.itunes.apple.com/...",
      "isDownloaded": false,
      "source": "itunes",
      "genre": "Hip-Hop/Rap"
    }
  ],
  "stats": {
    "myLibrary": 1,
    "external": 9,
    "sources": {
      "itunes": 5,
      "deezer": 4
    }
  }
}
```

---

### 2. Поиск только во внешних источниках

**GET** `/search/external?q={query}&limit={limit}`

Поиск только в iTunes и Deezer (без ваших треков).

#### Пример запроса:
```bash
GET /search/external?q=Taylor%20Swift&limit=20
Headers:
  X-Telegram-Init-Data: <init_data>
```

#### Пример ответа:
```json
{
  "success": true,
  "count": 20,
  "tracks": [
    {
      "id": 1234567890,
      "title": "Shake It Off",
      "artist": "Taylor Swift",
      "album": "1989",
      "duration": 242,
      "artwork": "https://is1-ssl.mzstatic.com/...",
      "previewUrl": "https://audio-ssl.itunes.apple.com/...",
      "releaseDate": "2014-08-18",
      "genre": "Pop",
      "source": "itunes"
    }
  ],
  "sources": {
    "itunes": 12,
    "deezer": 8
  }
}
```

---

### 3. Скачивание трека в библиотеку

**POST** `/search/download`

Скачивает превью трека из внешнего источника и добавляет в вашу библиотеку.

#### Тело запроса:
```json
{
  "previewUrl": "https://audio-ssl.itunes.apple.com/...",
  "title": "Lose Yourself",
  "artist": "Eminem"
}
```

#### Заголовки:
```
Content-Type: application/json
X-Telegram-Init-Data: <init_data>
```

#### Пример ответа (успех):
```json
{
  "success": true,
  "message": "Трек успешно добавлен в вашу библиотеку",
  "track": {
    "id": 42,
    "user_id": 123456,
    "name": "Eminem - Lose Yourself",
    "url": "https://res.cloudinary.com/...",
    "cloudinary_id": "arabutka/123456/Eminem_Lose_Yourself_1738843200",
    "created_at": "2026-02-06T12:00:00Z"
  }
}
```

#### Пример ответа (ошибка):
```json
{
  "error": "Не удалось скачать трек"
}
```

---

## Архитектура

### Сервисы поиска

**Файл:** `bot/services/musicSearch.js`

#### iTunes API
- Официальный API Apple  
- Бесплатный и легальный  
- Возвращает метаданные + 30-сек превью  

#### Deezer API
- Бесплатный публичный API  
- Большая база треков  
- Также 30-сек превью  

### Маршруты

**Файл:** `bot/routes/search.js`

Все эндпоинты защищены `authMiddleware` - требуется валидный Telegram Init Data.

### Процесс скачивания

1. **Пользователь выбирает трек** из результатов поиска
2. **Клиент отправляет POST** `/search/download` с `previewUrl`
3. **Сервер скачивает** превью (30 сек) из внешнего источника
4. **Загрузка в Cloudinary** в папку пользователя
5. **Сохранение в БД** с названием "Артист - Название"
6. **Трекинг события** `track_downloaded_from_search` в аналитике
7. **Возврат данных** о добавленном треке

---

## Использование во фронтенде

### Пример: Поиск треков

```javascript
const searchTracks = async (query) => {
  const response = await fetch(
    `${API_URL}/search/all?q=${encodeURIComponent(query)}&limit=20`,
    {
      headers: {
        'X-Telegram-Init-Data': window.Telegram.WebApp.initData
      }
    }
  );
  
  const data = await response.json();
  return data.tracks;
};
```

### Пример: Скачивание трека

```javascript
const downloadTrack = async (track) => {
  const response = await fetch(`${API_URL}/search/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': window.Telegram.WebApp.initData
    },
    body: JSON.stringify({
      previewUrl: track.previewUrl,
      title: track.title,
      artist: track.artist
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Трек добавлен:', result.track);
  }
};
```

### UI компоненты

#### Индикация статуса трека

```jsx
{track.isDownloaded ? (
  <Badge color="green">В библиотеке</Badge>
) : (
  <Button onClick={() => downloadTrack(track)}>
    Скачать
  </Button>
)}
```

---

## Ограничения

⚠️ **Длительность треков:** Скачиваются только превью (30 секунд)  
⚠️ **Легальность:** Используются официальные превью API  
⚠️ **Качество:** Зависит от источника (обычно 128-256 kbps)  
⚠️ **Rate Limits:** iTunes и Deezer могут ограничить частоту запросов  

---

## Аналитика

Каждое действие трекается в `bot/analytics.js`:

- `music_search` - пользователь выполнил поиск
- `external_search` - поиск только во внешних источниках  
- `track_downloaded_from_search` - трек скачан из поиска

---

## Будущие улучшения

🚀 **Планы на развитие:**

- [ ] Поддержка других источников (Spotify, SoundCloud)
- [ ] Кэширование популярных запросов
- [ ] Фильтры по жанру, году, длительности
- [ ] Рекомендации на основе истории поиска
- [ ] Полноценные треки (не только превью) через легальные API

---

## Примеры использования

### Сценарий 1: Поиск и добавление трека

1. Пользователь вводит "Coldplay" в поиск
2. Получает 20 результатов (2 из библиотеки + 18 внешних)
3. Видит индикацию скачанных треков
4. Нажимает "Скачать" на треке "Viva La Vida"
5. Трек добавляется в библиотеку за 2-3 секунды
6. Может сразу воспроизвести

### Сценарий 2: Проверка наличия трека

Пользователь ищет трек и сразу видит, есть ли он уже в библиотеке - не нужно скачивать дубликаты.

---

## Техническая информация

### Зависимости

```json
{
  "axios": "^1.6.0",
  "cloudinary": "^1.41.0"
}
```

### Переменные окружения

Не требуются дополнительные ключи API - используются публичные эндпоинты.

### Безопасность

✅ Все эндпоинты защищены `authMiddleware`  
✅ Валидация Telegram Init Data  
✅ Rate limiting через `express-rate-limit`  
✅ Санитизация названий файлов перед загрузкой  

---

**Документация обновлена:** 6 февраля 2026
