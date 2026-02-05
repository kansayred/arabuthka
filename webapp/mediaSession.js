/**
 * Media Session API Manager для Arabuthka
 * Управление воспроизведением с экрана блокировки и шторки уведомлений
 *
 * @author Arabuthka Team
 * @date 2026-02-04
 */

class MediaSessionManager {
  constructor(audioElement) {
    this.audio = audioElement;
    this.currentTrack = null;
    this.onPreviousCallback = null;
    this.onNextCallback = null;

    this.init();
  }

  // Запуск Media Session API
  init() {
    if (!('mediaSession' in navigator)) {
      console.warn('❌ Media Session API не поддерживается');
      return;
    }

    console.log('✅ Media Session API запущен');

    // Кнопка «играть»
    navigator.mediaSession.setActionHandler('play', () => {
      this.audio.play();
    });

    // Кнопка «пауза»
    navigator.mediaSession.setActionHandler('pause', () => {
      this.audio.pause();
    });

    // Кнопка «предыдущий трек»
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (this.onPreviousCallback) {
        this.onPreviousCallback();
      }
    });

    // Кнопка «следующий трек»
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (this.onNextCallback) {
        this.onNextCallback();
      }
    });

    // Перемотка на конкретный момент
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && this.audio.duration) {
        this.audio.currentTime = details.seekTime;
      }
    });

    // Обновляем позицию при воспроизведении
    this.audio.addEventListener('timeupdate', () => {
      this.updatePositionState();
    });
  }

  // Обновить метаданные трека для экрана блокировки
  updateMetadata(track) {
    if (!('mediaSession' in navigator)) return;

    this.currentTrack = track;

    // Берём обложку трека или заглушку
    const coverUrl = this.getAbsoluteUrl(track.coverUrl || '/default-cover.jpg');

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || 'Неизвестный трек',
      artist: track.artist || 'Неизвестный исполнитель',
      album: track.album || 'Arabuthka',
      artwork: [
        { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
        { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    console.log('🎵 Метаданные обновлены:', track.name);
    this.updatePositionState();
  }

  // Обновить позицию воспроизведения (для прогресс-бара на локскрине)
  updatePositionState() {
    if (!('mediaSession' in navigator) || !this.currentTrack) return;

    if (this.audio.duration && !isNaN(this.audio.duration)) {
      navigator.mediaSession.setPositionState({
        duration: this.audio.duration,
        playbackRate: this.audio.playbackRate,
        position: this.audio.currentTime,
      });
    }
  }

  // Обновить состояние — играет или на паузе
  updatePlaybackState(state) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  }

  // Колбэк на кнопку «предыдущий трек»
  onPrevious(callback) {
    this.onPreviousCallback = callback;
  }

  // Колбэк на кнопку «следующий трек»
  onNext(callback) {
    this.onNextCallback = callback;
  }

  // Превращаем относительный URL в абсолютный
  getAbsoluteUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return window.location.origin + url;
  }

  // Проверяем, поддерживает ли браузер Media Session
  static isSupported() {
    return 'mediaSession' in navigator;
  }

  // Очистить все обработчики при уничтожении
  destroy() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('seekto', null);

    console.log('🧹 Media Session очищен');
  }
}

// Экспорт для ES-модулей
export { MediaSessionManager };
