/**
 * AudioPlayer - Ядро аудио-плеера
 * Отвечает за воспроизведение, паузу, перемотку и управление очередью
 */
class AudioPlayer {
    constructor(options = {}) {
        this.audio = new Audio();
        this.tracks = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.repeatMode = 'none';
        this.volume = options.volume || 1;
        
        this.callbacks = {
            onTrackChange: options.onTrackChange || (() => {}),
            onStateChange: options.onStateChange || (() => {}),
            onTimeUpdate: options.onTimeUpdate || (() => {}),
            onError: options.onError || (() => {}),
            onEnded: options.onEnded || (() => {})
        };
        
        this._initEventListeners();
    }
    
    _initEventListeners() {
        this.audio.addEventListener('timeupdate', () => {
            this.callbacks.onTimeUpdate(this.audio.currentTime, this.audio.duration);
        });
        
        this.audio.addEventListener('ended', () => this._handleTrackEnd());
        this.audio.addEventListener('error', (e) => this.callbacks.onError(e));
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.callbacks.onStateChange(true);
        });
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.callbacks.onStateChange(false);
        });
    }
    
    loadTracks(tracks) {
        this.tracks = tracks || [];
        this.currentIndex = 0;
        if (this.tracks.length > 0) this._loadCurrentTrack();
    }
    
    _loadCurrentTrack() {
        const track = this.getCurrentTrack();
        if (!track) return;
        this.audio.src = track.url || track.file_path;
        this.audio.load();
        this.callbacks.onTrackChange(track, this.currentIndex);
    }
    
    getCurrentTrack() {
        return this.tracks[this.currentIndex] || null;
    }
    
    togglePlay() {
        this.isPlaying ? this.pause() : this.play();
    }
    
    async play() {
        try { await this.audio.play(); }
        catch (e) { this.callbacks.onError(e); }
    }
    
    pause() { this.audio.pause(); }
    
    next() {
        if (this.isShuffle) this._playRandomTrack();
        else {
            this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
            this._loadCurrentTrack();
            if (this.isPlaying) this.play();
        }
    }
    
    prev() {
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        this.currentIndex = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
        this._loadCurrentTrack();
        if (this.isPlaying) this.play();
    }
    
    playTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.currentIndex = index;
            this._loadCurrentTrack();
            this.play();
        }
    }
    
    seek(time) {
        if (!isNaN(time) && time >= 0)
            this.audio.currentTime = Math.min(time, this.audio.duration || 0);
    }
    
    seekPercent(percent) {
        if (this.audio.duration)
            this.seek((percent / 100) * this.audio.duration);
    }
    
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.audio.volume = this.volume;
    }
    
    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        return this.isShuffle;
    }
    
    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const idx = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(idx + 1) % modes.length];
        return this.repeatMode;
    }
    
    _handleTrackEnd() {
        this.callbacks.onEnded();
        switch(this.repeatMode) {
            case 'one': this.audio.currentTime = 0; this.play(); break;
            case 'all': this.next(); break;
            case 'none': if (this.currentIndex < this.tracks.length - 1) this.next(); break;
        }
    }
    
    _playRandomTrack() {
        if (this.tracks.length <= 1) return;
        let newIdx;
        do { newIdx = Math.floor(Math.random() * this.tracks.length); }
        while (newIdx === this.currentIndex);
        this.currentIndex = newIdx;
        this._loadCurrentTrack();
        if (this.isPlaying) this.play();
    }
    
    destroy() {
        this.pause();
        this.audio.src = '';
        this.tracks = [];
    }
}

window.AudioPlayer = AudioPlayer;
