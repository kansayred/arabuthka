// Арабутка — app-ui.js (UI helpers, search, sort, swipe, nav, keyboard)

// --- UTILITIES ---
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

// --- ICON / BUTTON HELPERS ---
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

// --- STATE ACCESSORS ---
let _getState = null;

export function initUI(getState) {
    _getState = getState;
    initSearch();
    initSortButtons();
    initSwipeGestures();
    initBottomNav();
    initKeyboardShortcuts();
}

// --- PAGINATION ---
const PAGE_SIZE = 20;
let _visibleCount = PAGE_SIZE;

export function resetPagination() { _visibleCount = PAGE_SIZE; }
export function loadMoreTracks() {
    if (!_getState) return;
    const { tracks } = _getState();
    if (_visibleCount >= tracks.length) return;
    _visibleCount = Math.min(_visibleCount + PAGE_SIZE, tracks.length);
    renderTracks();
}

// --- SORTING & RENDERING ---
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
    // Reset visible count when re-sorting/filtering
    _visibleCount = PAGE_SIZE;
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
    const visible = tracks.slice(0, _visibleCount);
    const hasMore = tracks.length > _visibleCount;
    trackList.innerHTML = visible.map((track, index) => {
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
    if (hasMore) {
        const remaining = tracks.length - _visibleCount;
        trackList.innerHTML += `<button class="load-more-btn" onclick="window._loadMoreTracks()">
            Показать ещё (${remaining})
        </button>`;
    }
    if (window.lucide) lucide.createIcons();
}

// --- LOCAL SEARCH ---
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

// --- SORT BUTTONS ---
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

// --- SWIPE GESTURES ---
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

// --- BOTTOM NAV — Real tab switching ---
let _currentTab = 'home';

function switchTab(tab) {
    if (tab === _currentTab) {
        // Already on this tab — scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    _currentTab = tab;

    // Hide all section-pages, show active one
    document.querySelectorAll('.section-page[data-tab]').forEach(page => {
        page.classList.toggle('active', page.getAttribute('data-tab') === tab);
    });

    // Update nav button active state
    document.querySelectorAll('.nav-item[data-tab]').forEach(n => {
        n.classList.toggle('active', n.getAttribute('data-tab') === tab);
    });

    // Scroll to top on tab change
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Tab-specific logic
    if (tab === 'search') {
        const inp = document.getElementById('globalSearchInput');
        if (inp) setTimeout(() => inp.focus(), 100);
    } else if (tab === 'profile') {
        renderProfile();
    } else if (tab === 'library') {
        // Re-render playlists when switching to library
        const ps = document.getElementById('playlistsSection');
        if (ps && window.PlaylistManager) window.PlaylistManager.loadAndRender(ps);
    }
}

function renderProfile() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const nameEl = document.getElementById('profileName');
    const usernameEl = document.getElementById('profileUsername');
    const avatarEl = document.getElementById('profileAvatar');
    const trackCountEl = document.getElementById('profileTrackCount');
    const playlistCountEl = document.getElementById('profilePlaylistCount');

    if (user) {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
        if (nameEl) nameEl.textContent = fullName || 'Пользователь';
        if (usernameEl) usernameEl.textContent = user.username ? '@' + user.username : '';
        if (avatarEl && user.photo_url) {
            avatarEl.innerHTML = '<img src="' + user.photo_url + '" alt="" class="profile-avatar-img">';
        }
    }

    if (trackCountEl && _getState) {
        trackCountEl.textContent = _getState().allTracks.length;
    }
    if (playlistCountEl && window.PlaylistManager) {
        playlistCountEl.textContent = window.PlaylistManager.playlists?.length || 0;
    }
}

function initBottomNav() {
    const tg = window.Telegram?.WebApp;
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    if (!navItems.length) return;
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            switchTab(tab);
            if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });
    });
}

// Export for external use
export { switchTab };

// Window export for load-more button onclick
window._loadMoreTracks = loadMoreTracks;

// --- KEYBOARD SHORTCUTS ---
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