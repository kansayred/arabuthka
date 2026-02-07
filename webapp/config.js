/**
 * Config - Конфигурация приложения
 * Централизованное хранение настроек
 */
const Config = {
    // API endpoints
    api: {
        baseUrl: '/api',
        searchEndpoint: '/search',
        downloadEndpoint: '/download',
        tracksEndpoint: '/tracks',
        timeout: 30000
    },
    
    // Настройки плеера
    player: {
        defaultVolume: 0.8,
        seekStep: 10, // секунды
        crossfadeDuration: 0, // миллисекунды
        rewindThreshold: 3 // секунды до перемотки в начало
    },
    
    // Настройки поиска
    search: {
        debounceDelay: 300, // миллисекунды
        minQueryLength: 2,
        maxResults: 50,
        sources: ['library', 'itunes']
    },
    
    // Настройки хранилища
    storage: {
        prefix: 'arabuthka_',
        keys: {
            tracks: 'tracks',
            settings: 'settings',
            lastTrack: 'lastTrack',
            volume: 'volume',
            shuffle: 'shuffle',
            repeat: 'repeat'
        }
    },
    
    // UI настройки
    ui: {
        animationDuration: 300,
        notificationTimeout: 3000,
        loadingDelay: 200,
        theme: 'dark'
    },
    
    // Telegram Web App
    telegram: {
        mainButtonText: 'Воспроизвести',
        mainButtonColor: '#2481cc',
        themeParams: null // заполняется при инициализации
    },
    
    // Поддерживаемые форматы
    supportedFormats: ['mp3', 'm4a', 'ogg', 'wav', 'webm'],
    
    // Ограничения
    limits: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxPlaylistSize: 1000,
        maxTitleLength: 100,
        maxArtistLength: 100
    },
    
    /**
     * Получение ключа хранилища с префиксом
     */
    getStorageKey(key) {
        return this.storage.prefix + (this.storage.keys[key] || key);
    },
    
    /**
     * Инициализация Telegram темы
     */
    initTelegramTheme() {
        if (window.Telegram && window.Telegram.WebApp) {
            this.telegram.themeParams = window.Telegram.WebApp.themeParams;
        }
    },
    
    /**
     * Проверка поддерживаемого формата
     */
    isSupportedFormat(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return this.supportedFormats.includes(ext);
    }
};

// Заморозка конфигурации
Object.freeze(Config.api);
Object.freeze(Config.player);
Object.freeze(Config.search);
Object.freeze(Config.storage);
Object.freeze(Config.ui);
Object.freeze(Config.limits);

window.Config = Config;
