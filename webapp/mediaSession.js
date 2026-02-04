/**
 * Media Session API Manager for Arabuthka
 * Provides lock screen and notification controls for audio playback
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

  /**
   * Initialize Media Session API
   */
  init() {
    if (!('mediaSession' in navigator)) {
      console.warn('❌ Media Session API not supported in this browser');
      return;
    }

    console.log('✅ Media Session API initialized');

    // Set up action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      this.audio.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.audio.pause();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (this.onPreviousCallback) {
        this.onPreviousCallback();
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (this.onNextCallback) {
        this.onNextCallback();
      }
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && this.audio.duration) {
        this.audio.currentTime = details.seekTime;
      }
    });

    // Update position on timeupdate
    this.audio.addEventListener('timeupdate', () => {
      this.updatePositionState();
    });
  }

  /**
   * Update track metadata for lock screen display
   * @param {Object} track - Track object with title, artist, album, coverUrl, duration
   */
  updateMetadata(track) {
    if (!('mediaSession' in navigator)) return;

    this.currentTrack = track;

    // Get absolute URL for cover image
    const coverUrl = this.getAbsoluteUrl(track.coverUrl || '/default-cover.jpg');

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
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

    console.log('🎵 Updated media metadata:', track.name);
    this.updatePositionState();
  }

  /**
   * Update playback position state
   */
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

  /**
   * Update playback state (playing/paused)
   * @param {string} state - 'playing' or 'paused'
   */
  updatePlaybackState(state) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  }

  /**
   * Set callback for previous track action
   * @param {Function} callback
   */
  onPrevious(callback) {
    this.onPreviousCallback = callback;
  }

  /**
   * Set callback for next track action
   * @param {Function} callback
   */
  onNext(callback) {
    this.onNextCallback = callback;
  }

  /**
   * Convert relative URL to absolute URL
   * @param {string} url
   * @returns {string}
   */
  getAbsoluteUrl(url) {
    // If already absolute URL (starts with http/https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Convert relative to absolute
    return window.location.origin + url;
  }

  /**
   * Check if Media Session API is supported
   * @returns {boolean}
   */
  static isSupported() {
    return 'mediaSession' in navigator;
  }

  /**
   * Cleanup and remove all action handlers
   */
  destroy() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('seekto', null);

    console.log('🧹 Media Session cleaned up');
  }
}
