/**
 * PlayerUI - Модуль управления интерфейсом плеера
 * Отвечает за отображение информации о треке и управление UI элементами
 */
class PlayerUI {
    constructor() {
        this.elements = {
            cover: document.getElementById('cover'),
            title: document.getElementById('track-title'),
            artist: document.getElementById('track-artist'),
            playPauseBtn: document.getElementById('play-pause-btn'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            shuffleBtn: document.getElementById('shuffle-btn'),
            repeatBtn: document.getElementById('repeat-btn'),
            progressBar: document.getElementById('progress-bar'),
            progressFill: document.getElementById('progress-fill'),
            currentTime: document.getElementById('current-time'),
            totalTime: document.getElementById('total-time'),
            volumeSlider: document.getElementById('volume-slider'),
            volumeIcon: document.getElementById('volume-icon')
        };
        
        this.defaultCover = 'assets/default-cover.png';
    }
    
    /**
     * Обновление отображения трека
     */
    updateTrackDisplay(track) {
        if (!track) return;
        
        this.elements.title.textContent = track.title || 'Неизвестный трек';
        this.elements.artist.textContent = track.artist || 'Неизвестный исполнитель';
        this.updateCover(track.cover);
    }
    
    /**
     * Обновление обложки
     */
    updateCover(coverUrl) {
        const cover = this.elements.cover;
        if (coverUrl) {
            cover.style.backgroundImage = `url(${coverUrl})`;
            cover.classList.remove('no-cover');
        } else {
            cover.style.backgroundImage = `url(${this.defaultCover})`;
            cover.classList.add('no-cover');
        }
    }
    
    /**
     * Обновление состояния кнопки воспроизведения
     */
    updatePlayButton(isPlaying) {
        const btn = this.elements.playPauseBtn;
        btn.innerHTML = isPlaying ? '⏸️' : '▶️';
        btn.setAttribute('aria-label', isPlaying ? 'Пауза' : 'Воспроизведение');
    }
    
    /**
     * Обновление прогресс-бара
     */
    updateProgress(currentTime, duration) {
        if (!duration || duration === 0) return;
        
        const percent = (currentTime / duration) * 100;
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.currentTime.textContent = this.formatTime(currentTime);
        this.elements.totalTime.textContent = this.formatTime(duration);
    }
    
    /**
     * Форматирование времени в MM:SS
     */
    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Обновление иконки громкости
     */
    updateVolumeIcon(volume, isMuted) {
        const icon = this.elements.volumeIcon;
        if (isMuted || volume === 0) {
            icon.innerHTML = '🔇';
        } else if (volume < 0.5) {
            icon.innerHTML = '🔉';
        } else {
            icon.innerHTML = '🔊';
        }
    }
    
    /**
     * Обновление состояния кнопки перемешивания
     */
    updateShuffleButton(isActive) {
        this.elements.shuffleBtn.classList.toggle('active', isActive);
    }
    
    /**
     * Обновление состояния кнопки повтора
     */
    updateRepeatButton(mode) {
        const btn = this.elements.repeatBtn;
        btn.classList.remove('repeat-one', 'repeat-all');
        
        switch(mode) {
            case 'one':
                btn.classList.add('active', 'repeat-one');
                btn.innerHTML = '🔂';
                break;
            case 'all':
                btn.classList.add('active', 'repeat-all');
                btn.innerHTML = '🔁';
                break;
            default:
                btn.classList.remove('active');
                btn.innerHTML = '🔁';
        }
    }
    
    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    /**
     * Показать/скрыть индикатор загрузки
     */
    setLoading(isLoading) {
        document.body.classList.toggle('loading', isLoading);
    }
}

// Экспорт для использования в других модулях
window.PlayerUI = PlayerUI;
