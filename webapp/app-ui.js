// Арабутка — app-ui.js (UI helpers, search, sort, swipe, nav, keyboard)
// No imports from app.js — uses window.* or callbacks passed via initUI()

// ===========================================
// UTILITIES (exported for app.js)
// ===========================================
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text; return div.innerHTML;
}
export function sanitizeCoverUrl(url) {
    if (!url) return '';
    try { const p = new URL(url); if (p.protocol === 'https:' || p.protocol === 'data:') return url; } catch {}
    return '';
}
export function revokeCurrentObjectUrl() { /* state managed by app.js; placeholder for import */ }
export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===========================================
// ICON / BUTTON HELPERS
// ===========================================
export function setLucideIcon(element, iconName) {
    if (!element) return;
    element.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) lucide.createIcons({ nodes: [element] });
}
export function updatePlayButton(isPlaying) {
    setLucideIcon(document.getElementById('playBtn'), isPlaying ? 'pause' : 'play');
}
export function updateMuteIcon(vol) {
    const btn = document.getElementById('muteBtn'); if (!btn) return;
    setLucideIcon(btn, vol === 0 ? 'volume-x' : vol < 0.5 ? 'volume-1' : 'volume-2');
}
export function updateCoverAnimation(isPlaying) {
    const coverArt = document.getElementById('coverArt'); if (!coverArt) return;
    coverArt.classList.toggle('paused', !isPlaying);
}

// ===========================================
// STATE ACCESSORS (set by initUI)
// ===========================================
let _getState = null; // injected by app.js

/**
 * Called by app.js after module init.
 * getState: () => { tracks, allTracks, searchQuery, sortMode, audio, getActiveTrackId }
 */
export function initUI(getState) {
    _getState = getState;
    initSearch();
    initSortButtons();
    initSwipeGestures();
    initBottomNav();
    initKeyboardShortcuts();
}

// ===========================================
// SORTING & RENDERING (exported for app.js)
// ===========================================
export function applySorting() {
    if (!_getState) return;
    const { tracks, allTracks, searchQuery, sortMode } = _getState();
    const sq = (searchQuery || '').toLowerCase();
    let filtered = sq
        ? allTracks.filter(t =>
            t.name.toLowerCase().includes(sq) ||
            (t.artist && t.artist.toLowerCase().includes(sq)) ||
            (t.album && t.album.toLowerCase().includes(sq))
          )
        : [...allTracks];
    if (sortMode === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    else filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // Mutate shared tracks array in-place
    tracks.length = 0;
    filtered.forEach(t => tracks.push(t));
}

export function renderTracks() {
    if (!_getState) return;
    const { tracks, searchQuery, audio, getActiveTrackId } = _getState();
    const trackList = document.getElementById('trackList');
    if (!trackList) return;
    if (tracks.length === 0) {
        trackList.innerHTML = searchQuery
            ? '<div class="empty-state">🔍 Ничего не найдено</div>'
            : '<div class="empty-state">🎵 Загрузи свой первый трек!</div>';
        return;
    }
    const activeId = getActiveTrackId();
    trackList.innerHTML = tracks.map((track, index) => {
        const isActive = track.id === activeId;
        const isPlaying = isActive && !audio.paused;
        const eq = isPlaying
            ? '<div class="equalizer"><div class="equalizer-bar"></div><div class="equalizer-bar"></div><div class="equalizer-bar"></div><div class="equalizer-bar"></div></div>'
            : '';
        return `<div class="track-item ${isActive ? 'active' : ''}" data-swipe-index="${index}" onclick="playTrack(${index})">
            <span class="track-number">${index + 1}</span>
            <div class="track-info-item">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist-small">${escapeHtml(track.artist || 'Неизвестный исполнитель')}</div>
            </div>
            ${eq}
            <button class="track-delete" onclick="event.stopPropagation();deleteTrack(${Number(track.id)})">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
        </div>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

// ===========================================
// LOCAL SEARCH
// ===========================================
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim();
            if (_getState) {
                const s = _getState(); s.setSearchQuery(q);
            }
            if (clearSearch) clearSearch.style.display = q ? 'flex' : 'none';
            applySorting(); renderTracks();
        });
    }
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (_getState) { const s = _getState(); s.setSearchQuery(''); }
            clearSearch.style.display = 'none';
            applySorting(); renderTracks();
        });
    }
}

// ===========================================
// SORT BUTTONS
// ===========================================
function initSortButtons() {
    document.querySelectorAll('.sort-btn[data-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (_getState) { const s = _getState(); s.setSortMode(btn.getAttribute('data-sort')); }
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applySorting(); renderTracks();
        });
    });
}

// ===========================================
// SWIPE GESTURES
// ===========================================
function initSwipeGestures() {
    const trackListEl = document.getElementById('trackList');
    if (!trackListEl) return;
    let startX = 0, startY = 0, currentEl = null, isDragging = false;
    const THRESHOLD = 70;
    trackListEl.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.track-item'); if (!item) return;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        currentEl = item; isDragging = false;
        item.classList.remove('snap-back'); item.classList.add('swiping');
    }, { passive: true });
    trackListEl.addEventListener('touchmove', (e) => {
        if (!currentEl) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (!isDragging && Math.abs(dy) > Math.abs(dx)) { currentEl = null; return; }
        isDragging = true;
        currentEl.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`;
    }, { passive: true });
    trackListEl.addEventListener('touchend', () => {
        if (!currentEl) return;
        const match = currentEl.style.transform.match(/translateX\(([-\d.]+)px\)/);
        const dx = match ? parseFloat(match[1]) : 0;
        currentEl.classList.remove('swiping'); currentEl.classList.add('snap-back');
        const tracks = _getState ? _getState().tracks : [];
        const idx = currentEl.getAttribute('data-swipe-index');
        if (dx > THRESHOLD && idx !== null && tracks[idx]) window.addToQueue(tracks[idx]);
        else if (dx < -THRESHOLD && idx !== null && tracks[idx]) window.deleteTrack(tracks[idx].id);
        currentEl.style.transform = 'translateX(0)';
        currentEl = null; isDragging = false;
    }, { passive: true });
}

// ===========================================
// BOTTOM NAV
// ===========================================
function initBottomNav() {
    const tg = window.Telegram?.WebApp;
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    if (!navItems.length) return;
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const tab = item.getAttribute('data-tab');
            if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
            else if (tab === 'library') {
                const tl = document.getElementById('trackList');
                if (tl) tl.scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'playlists') {
                const pl = document.getElementById('playlistsSection');
                if (pl) pl.scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'search') {
                const gs = document.querySelector('.global-search-section');
                if (gs) { gs.scrollIntoView({ behavior: 'smooth' }); const inp = document.getElementById('globalSearchInput'); if (inp) setTimeout(() => inp.focus(), 400); }
            } else if (tab === 'profile') {
                const user = tg?.initDataUnsafe?.user;
                const allCount = _getState ? _getState().allTracks.length : 0;
                if (user) window.showToast?.(`👤 ${user.first_name || ''} • ${allCount} треков`);
            }
            if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });
    });
}

// ===========================================
// KEYBOARD SHORTCUTS
// ===========================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.code) {
            case 'Space': e.preventDefault(); window.togglePlay?.(); break;
            case 'ArrowRight': e.preventDefault(); window.nextTrack?.(); break;
            case 'ArrowLeft': e.preventDefault(); window.prevTrack?.(); break;
            case 'KeyS': if (!e.ctrlKey) window.toggleShuffle?.(); break;
            case 'KeyR': if (!e.ctrlKey) window.toggleRepeat?.(); break;
            case 'KeyM': window.toggleMute?.(); break;
        }
    });
}
