/**
 * Media Session API Manager для Arabuthka
 * Управление воспроизведением с экрана блокировки и шторки уведомлений
 *
 * @author Arabuthka Team
 * @date 2026-02-04
 * 
 * ВАЖНО: В Telegram WebView Media Session может работать ограниченно.
 * Полная функциональность доступна при установке приложения как PWA
 * или при открытии напрямую в браузере.
 */

// Дефолтная обложка в виде data URL (простой музыкальный символ)
// Это гарантирует что обложка всегда доступна, даже офлайн
const DEFAULT_COVER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9IiMxNjIxM2UiLz48dGV4dCB4PSIyNTYiIHk9IjI4MCIgZm9udC1zaXplPSIyMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiPvCfjrU8L3RleHQ+PC9zdmc+';

class MediaSessionManager {
    constructor(audioElement) {
        this.audio = audioElement;
        this.currentTrack = null;
        this.onPreviousCallback = null;
        this.onNextCallback = null;
        this.isInTelegramWebView = this.detectTelegramWebView();

        this.init();
    }

    // Определяем, запущено ли приложение внутри Telegram WebView
    detectTelegramWebView() {
        const isTelegram = window.Telegram && window.Telegram.WebApp;
        if (isTelegram) {
            console.log('📱 Обнаружен Telegram WebView');
            console.log('ℹ️ Media Session может работать ограниченно в Telegram.');
            console.log('💡 Для полной поддержки — установи приложение на главный экран');
        }
        return !!isTelegram;
    }

    // Запуск Media Session API
    init() {
        if (!('mediaSession' in navigator)) {
            console.warn('❌ Media Session API не поддерживается этим браузером');
            return;
        }

        console.log('✅ Media Session API доступен');
        
        // Проверим, реально ли работает setActionHandler
        try {
            // Кнопка «играть»
            navigator.mediaSession.setActionHandler('play', () => {
                console.log('▶️ Media Session: play');
                this.audio.play();
            });

            // Кнопка «пауза»
            navigator.mediaSession.setActionHandler('pause', () => {
                console.log('⏸️ Media Session: pause');
                this.audio.pause();
            });

            // Кнопка «предыдущий трек»
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                console.log('⏮️ Media Session: previous');
                if (this.onPreviousCallback) {
                    this.onPreviousCallback();
                }
            });

            // Кнопка «следующий трек»
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                console.log('⏭️ Media Session: next');
                if (this.onNextCallback) {
                    this.onNextCallback();
                }
            });

            // Перемотка на конкретный момент
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime && this.audio.duration) {
                    console.log('⏩ Media Session: seek to', details.seekTime);
                    this.audio.currentTime = details.seekTime;
                }
            });

            console.log('✅ Все обработчики Media Session установлены');
        } catch (error) {
            console.warn('⚠️ Ошибка при установке обработчиков Media Session:', error);
        }

        // Обновляем позицию при воспроизведении (не слишком часто)
        let lastUpdate = 0;
        this.audio.addEventListener('timeupdate', () => {
            const now = Date.now();
            // Обновляем не чаще раза в секунду, чтобы не грузить систему
            if (now - lastUpdate > 1000) {
                this.updatePositionState();
                lastUpdate = now;
            }
        });
    }

    // Обновить метаданные трека для экрана блокировки
    updateMetadata(track) {
        if (!('mediaSession' in navigator)) return;

        this.currentTrack = track;

        // Используем обложку трека или дефолтную
        const coverUrl = track.coverUrl || DEFAULT_COVER;

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.name || 'Неизвестный трек',
                artist: track.artist || 'Arabuthka',
                album: track.album || 'Моя музыка',
                artwork: [
                    { src: coverUrl, sizes: '96x96', type: 'image/png' },
                    { src: coverUrl, sizes: '128x128', type: 'image/png' },
                    { src: coverUrl, sizes: '192x192', type: 'image/png' },
                    { src: coverUrl, sizes: '256x256', type: 'image/png' },
                    { src: coverUrl, sizes: '384x384', type: 'image/png' },
                    { src: coverUrl, sizes: '512x512', type: 'image/png' },
                ],
            });

            console.log('🎵 Метаданные обновлены:', track.name);
        } catch (error) {
            console.warn('⚠️ Ошибка при обновлении метаданных:', error);
        }

        this.updatePositionState();
    }

    // Обновить позицию воспроизведения (для прогресс-бара на локскрине)
    updatePositionState() {
        if (!('mediaSession' in navigator) || !this.currentTrack) return;

        if (this.audio.duration && !isNaN(this.audio.duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackRate: this.audio.playbackRate,
                    position: this.audio.currentTime,
                });
            } catch (error) {
                // Некоторые браузеры не поддерживают setPositionState
            }
        }
    }

    // Обновить состояние — играет или на паузе
    updatePlaybackState(state) {
        if (!('mediaSession' in navigator)) return;

        try {
            navigator.mediaSession.playbackState = state;
            console.log('🔄 Playback state:', state);
        } catch (error) {
            // Игнорируем ошибки
        }
    }

    // Колбэк на кнопку «предыдущий трек»
    onPrevious(callback) {
        this.onPreviousCallback = callback;
    }

    // Колбэк на кнопку «следующий трек»
    onNext(callback) {
        this.onNextCallback = callback;
    }

    // Проверяем, поддерживает ли браузер Media Session
    static isSupported() {
        return 'mediaSession' in navigator;
    }

    // Возвращает true если мы в Telegram WebView (ограниченная функциональность)
    isLimitedEnvironment() {
        return this.isInTelegramWebView;
    }

    // Очистить все обработчики при уничтожении
    destroy() {
        if (!('mediaSession' in navigator)) return;

        try {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
            navigator.mediaSession.setActionHandler('nexttrack', null);
            navigator.mediaSession.setActionHandler('seekto', null);
            console.log('🧹 Media Session очищен');
        } catch (error) {
            // Игнорируем ошибки при очистке
        }
    }
}

// Экспорт для ES-модулей
export { MediaSessionManager };
