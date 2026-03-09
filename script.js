// Initialize Lucide icons
lucide.createIcons();

// State
let currentUser = JSON.parse(localStorage.getItem('spotihermes_user')) || null;
let currentSongIndex = 0;
let isPlaying = false;
let showLyrics = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');
const adminBtn = document.getElementById('admin-btn');
const songsList = document.getElementById('songs-list');
const songCount = document.getElementById('song-count');
const audio = document.getElementById('audio-player');

const playerView = document.getElementById('player-view');
const libraryView = document.getElementById('library-view');
const backToLib = document.getElementById('back-to-lib');

const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');

const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playerCover = document.getElementById('player-cover');
const lyricsBtn = document.getElementById('lyrics-btn');
const lyricsOverlay = document.getElementById('lyrics-overlay');
const lyricsText = document.getElementById('lyrics-text');

const miniPlayer = document.getElementById('mini-player');
const miniTitle = document.getElementById('mini-title');
const miniArtist = document.getElementById('mini-artist');
const miniCover = document.getElementById('mini-cover');
const miniPlayBtn = document.getElementById('mini-play-btn');
const miniPlayIcon = document.getElementById('mini-play-icon');

const adminModal = document.getElementById('admin-modal');
const closeModal = document.getElementById('close-modal');
const modalOk = document.getElementById('modal-ok');
const modalOverlay = document.getElementById('modal-overlay');

// Users
const USERS = {
    admin: { username: "hermesherasme", password: "herasmehermes18", role: "admin" },
    user: { username: "karendesiree", password: "1132026", role: "user" },
};

// Initialize
function init() {
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
    renderSongs();
    loadSong(0);
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userDisplay.textContent = currentUser.username;
    if (currentUser.role === 'admin') {
        adminBtn.classList.remove('hidden');
    } else {
        adminBtn.classList.add('hidden');
    }
}

// Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const user = Object.values(USERS).find(u => u.username === username && u.password === password);

    if (user) {
        currentUser = { username: user.username, role: user.role };
        localStorage.setItem('spotihermes_user', JSON.stringify(currentUser));
        showApp();
        addToast(`¡Bienvenido, ${user.username}!`, 'success');
    } else {
        addToast('Credenciales incorrectas', 'error');
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('spotihermes_user');
    pauseSong();
    showLogin();
});

// Songs Rendering
function renderSongs() {
    songsList.innerHTML = '';
    songCount.textContent = `${STATIC_SONGS.length} CANCIONES`;

    STATIC_SONGS.forEach((song, index) => {
        const songEl = document.createElement('div');
        songEl.className = `group flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all active:scale-95 ${currentSongIndex === index ? 'bg-red-600/10 border border-red-600/20' : 'bg-white/5 border border-transparent hover:bg-white/10'}`;
        
        songEl.innerHTML = `
            <div class="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5 shadow-lg">
                <img src="${song.coverUrl}" class="w-full h-full object-cover" onerror="this.src='https://picsum.photos/seed/music/200/200'">
                ${currentSongIndex === index && isPlaying ? `
                    <div class="absolute inset-0 bg-red-600/40 backdrop-blur-[2px] flex items-center justify-center">
                        <div class="flex gap-0.5 items-end h-5">
                            <div class="w-1 bg-white rounded-full playing-bar" style="animation-delay: 0.1s"></div>
                            <div class="w-1 bg-white rounded-full playing-bar" style="animation-delay: 0.3s"></div>
                            <div class="w-1 bg-white rounded-full playing-bar" style="animation-delay: 0.2s"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-bold truncate text-base ${currentSongIndex === index ? 'text-red-400' : 'text-white'}">${song.title}</h3>
                <p class="text-xs font-semibold text-white/40 truncate mt-0.5">${song.artist}</p>
            </div>
        `;

        songEl.addEventListener('click', () => {
            if (currentSongIndex === index) {
                togglePlay();
            } else {
                playSong(index);
            }
        });

        songsList.appendChild(songEl);
    });
}

// Player Logic
function loadSong(index) {
    currentSongIndex = index;
    const song = STATIC_SONGS[index];
    audio.src = song.audioUrl;
    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist;
    playerCover.src = song.coverUrl;
    lyricsText.textContent = song.lyrics || "No hay letra disponible.";
    
    miniTitle.textContent = song.title;
    miniArtist.textContent = song.artist;
    miniCover.src = song.coverUrl;

    renderSongs();
}

function playSong(index) {
    if (index !== undefined) loadSong(index);
    isPlaying = true;
    audio.play();
    updatePlayIcons();
    miniPlayer.classList.remove('hidden');
    renderSongs();
}

function pauseSong() {
    isPlaying = false;
    audio.pause();
    updatePlayIcons();
    renderSongs();
}

function togglePlay() {
    if (isPlaying) {
        pauseSong();
    } else {
        playSong();
    }
}

function updatePlayIcons() {
    if (isPlaying) {
        playIcon.setAttribute('data-lucide', 'pause');
        miniPlayIcon.setAttribute('data-lucide', 'pause');
    } else {
        playIcon.setAttribute('data-lucide', 'play');
        miniPlayIcon.setAttribute('data-lucide', 'play');
    }
    lucide.createIcons();
}

playBtn.addEventListener('click', togglePlay);
miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
});

prevBtn.addEventListener('click', () => {
    currentSongIndex = (currentSongIndex - 1 + STATIC_SONGS.length) % STATIC_SONGS.length;
    playSong(currentSongIndex);
});

nextBtn.addEventListener('click', () => {
    currentSongIndex = (currentSongIndex + 1) % STATIC_SONGS.length;
    playSong(currentSongIndex);
});

audio.addEventListener('ended', () => {
    currentSongIndex = (currentSongIndex + 1) % STATIC_SONGS.length;
    playSong(currentSongIndex);
});

// Progress Bar
audio.addEventListener('timeupdate', () => {
    const { duration, currentTime } = audio;
    const progressPercent = (currentTime / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
    
    currentTimeEl.textContent = formatTime(currentTime);
    durationEl.textContent = formatTime(duration);
});

progressContainer.addEventListener('click', (e) => {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;
    audio.currentTime = (clickX / width) * duration;
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// UI Toggles
lyricsBtn.addEventListener('click', () => {
    showLyrics = !showLyrics;
    lyricsOverlay.classList.toggle('hidden', !showLyrics);
    lyricsBtn.classList.toggle('bg-red-600', showLyrics);
    lyricsBtn.classList.toggle('text-white', showLyrics);
});

miniPlayer.addEventListener('click', () => {
    if (window.innerWidth < 1024) {
        playerView.classList.remove('hidden');
        playerView.classList.add('flex');
        libraryView.classList.add('hidden');
    }
});

backToLib.addEventListener('click', () => {
    playerView.classList.add('hidden');
    playerView.classList.remove('flex');
    libraryView.classList.remove('hidden');
});

// Admin Modal
adminBtn.addEventListener('click', () => adminModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => adminModal.classList.add('hidden'));
modalOk.addEventListener('click', () => adminModal.classList.add('hidden'));
modalOverlay.addEventListener('click', () => adminModal.classList.add('hidden'));

// Toasts
function addToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 transform translate-x-full opacity-0`;
    
    const colors = {
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        info: 'bg-white/10 border-white/10 text-white'
    };
    
    toast.classList.add(...colors[type].split(' '));
    
    const icon = {
        success: 'check-circle-2',
        error: 'alert-circle',
        info: 'info'
    }[type];

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span class="text-sm font-bold">${message}</span>
    `;

    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    lucide.createIcons();

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    }, 10);

    // Remove
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Responsive
window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
        playerView.classList.remove('hidden');
        playerView.classList.add('flex');
        libraryView.classList.remove('hidden');
    } else {
        if (!isPlaying) {
            playerView.classList.add('hidden');
            playerView.classList.remove('flex');
            libraryView.classList.remove('hidden');
        }
    }
});

init();
