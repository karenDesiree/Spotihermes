import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Music, 
  Upload, 
  Edit2, 
  Trash2, 
  LogOut, 
  User as UserIcon,
  Plus,
  X,
  ArrowLeft,
  Mic2,
  AlertCircle,
  CheckCircle2,
  Info,
  LogIn,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Song } from './types';
import { db, storage } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL
} from 'firebase/storage';

const PenguinIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    {/* Head (Blue) */}
    <circle cx="12" cy="12" r="11" fill="#3b82f6" />
    {/* Face (White) */}
    <ellipse cx="12" cy="14" rx="8" ry="7" fill="white" />
    {/* Eyes (Large and tender) */}
    <circle cx="8.5" cy="12" r="2.8" fill="black" />
    <circle cx="15.5" cy="12" r="2.8" fill="black" />
    {/* Eye Highlights */}
    <circle cx="7.5" cy="11" r="0.8" fill="white" />
    <circle cx="14.5" cy="11" r="0.8" fill="white" />
    {/* Beak */}
    <path d="M10.5 14.5L12 17L13.5 14.5H10.5Z" fill="#FF9900" />
    {/* Headphones Band (Red) */}
    <path d="M2 13C2 6 6 1 12 1C18 1 22 6 22 13" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
    {/* Headphones Cups (Red) */}
    <rect x="0" y="11" width="4" height="8" rx="2" fill="#dc2626" />
    <rect x="20" y="11" width="4" height="8" rx="2" fill="#dc2626" />
  </svg>
);

const USERS = {
  admin: { username: "hermesherasme", password: "herasmehermes18", role: "admin" as const },
  user: { username: "karendesiree", password: "1132026", role: "user" as const },
};

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('spotihermes_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [view, setView] = useState<'library' | 'player'>('library');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  const [toasts, setToasts] = useState<{ id: string, message: string, type: 'success' | 'error' | 'info' }[]>([]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const songsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Song[];
        setSongs(songsData);
        if (songsData.length > 0 && currentSongId === null) {
          setCurrentSongId(songsData[0].id);
        }
      }, (error) => {
        console.error("Firestore Error:", error);
        addToast("Error al cargar las canciones", "error");
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = (formData.get('username') as string || '').trim();
    const password = (formData.get('password') as string || '').trim();

    console.log('Intentando login con:', username);

    const foundUser = Object.values(USERS).find(
      (u) => u.username === username && u.password === password
    );

    if (foundUser) {
      console.log('Login exitoso para:', foundUser.username);
      const userData: User = { username: foundUser.username, role: foundUser.role };
      setUser(userData);
      localStorage.setItem('spotihermes_user', JSON.stringify(userData));
      addToast(`¡Bienvenido, ${foundUser.username}!`, 'success');
    } else {
      console.warn('Login fallido para:', username);
      addToast('Credenciales incorrectas', 'error');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('spotihermes_user');
    setIsPlaying(false);
    addToast('Sesión cerrada', 'info');
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user?.role !== 'admin') return;
    
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const lyrics = formData.get('lyrics') as string;
    const audioFile = formData.get('audio') as File;
    const coverFile = formData.get('cover') as File;

    try {
      let audioUrl = editingSong?.audioUrl || '';
      let coverUrl = editingSong?.coverUrl || null;

      // Upload audio if new file selected
      if (audioFile && audioFile.size > 0) {
        const audioStorageRef = ref(storage, `songs/${Date.now()}_${audioFile.name}`);
        const uploadResult = await uploadBytes(audioStorageRef, audioFile);
        audioUrl = await getDownloadURL(uploadResult.ref);
      }

      // Upload cover if new file selected
      if (coverFile && coverFile.size > 0) {
        const coverStorageRef = ref(storage, `covers/${Date.now()}_${coverFile.name}`);
        const uploadResult = await uploadBytes(coverStorageRef, coverFile);
        coverUrl = await getDownloadURL(uploadResult.ref);
      }

      const songData = {
        title,
        artist,
        lyrics,
        audioUrl,
        coverUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingSong) {
        await updateDoc(doc(db, 'songs', editingSong.id), songData);
        addToast('Canción actualizada', 'success');
      } else {
        await addDoc(collection(db, 'songs'), {
          ...songData,
          createdAt: serverTimestamp(),
          ownerId: 'admin'
        });
        addToast('Canción subida con éxito', 'success');
      }
      
      setIsAdminModalOpen(false);
      setEditingSong(null);
    } catch (err) {
      console.error('Error uploading song:', err);
      addToast('Error al procesar la canción', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteSong = async (id: string) => {
    try {
      const songToDelete = songs.find(s => s.id === id);
      if (songToDelete) {
        // Optional: Delete files from storage too
        // For simplicity and to avoid errors if URLs are external, we just delete the doc
        await deleteDoc(doc(db, 'songs', id));
        addToast('Canción eliminada', 'success');
      }
    } catch (err) {
      console.error('Error deleting song:', err);
      addToast('Error al eliminar la canción', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playSong = (id: string) => {
    setCurrentSongId(id);
    setIsPlaying(true);
    setTimeout(() => {
      audioRef.current?.play();
    }, 100);
  };

  const nextSong = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.id === currentSongId);
    const nextIndex = (currentIndex + 1) % songs.length;
    playSong(songs[nextIndex].id);
  };

  const prevSong = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.id === currentSongId);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(songs[prevIndex].id);
  };

  const currentSong = songs.find(s => s.id === currentSongId) || songs[0];
  const currentSongIndex = songs.findIndex(s => s.id === currentSongId);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center p-6 font-sans text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl"
        >
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              animate={{ rotate: isPlaying ? [0, -5, 5, 0] : 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mb-8"
            >
              <PenguinIcon size={120} />
            </motion.div>
            <h1 className="text-4xl font-black tracking-tighter">Spotihermes</h1>
            <p className="text-white/40 text-sm mt-3 font-medium">Tu música, tu espacio</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1 flex items-center gap-2">
                <UserIcon size={10} /> Usuario
              </label>
              <input 
                name="username"
                type="text" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all placeholder:text-white/20"
                placeholder="Nombre de usuario"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1 flex items-center gap-2">
                <Lock size={10} /> Contraseña
              </label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all placeholder:text-white/20"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-white text-black font-black py-5 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.95] shadow-xl mt-4 flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              ENTRAR
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans overflow-hidden selection:bg-red-600/30">
      {/* Dynamic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div 
          animate={{ 
            scale: isPlaying ? [1, 1.1, 1] : 1,
            opacity: isPlaying ? [0.15, 0.25, 0.15] : 0.15
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-[-20%] left-[-20%] w-[100%] h-[100%] rounded-full blur-[150px] transition-colors duration-1000"
          style={{ backgroundColor: currentSong?.coverUrl ? '#dc2626' : '#1a1a1a' }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-20%] w-[100%] h-[100%] rounded-full blur-[150px] opacity-10 transition-colors duration-1000"
          style={{ backgroundColor: currentSong?.coverUrl ? '#991b1b' : '#000000' }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-screen max-w-7xl mx-auto lg:px-6">
        {/* Header */}
        <header className="p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <PenguinIcon size={40} />
            <h1 className="text-lg font-black tracking-tighter">Spotihermes</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {user.role === 'admin' && (
              <button 
                onClick={() => { setEditingSong(null); setIsAdminModalOpen(true); }}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
              >
                <Plus size={20} />
              </button>
            )}
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <UserIcon size={14} className="text-red-600" />
              <span className="text-xs font-bold">{user.username}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all text-white/60"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative lg:grid lg:grid-cols-12 lg:gap-8 lg:pb-8">
          {/* Desktop Library (Always visible on large screens) */}
          <div className="hidden lg:flex lg:col-span-4 flex-col bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tighter">Tu Biblioteca</h2>
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{songs.length} CANCIONES</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {songs.map((song) => (
                    <div 
                      key={song.id}
                      onClick={() => playSong(song.id)}
                      className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${
                        currentSongId === song.id ? 'bg-red-600/20 border border-red-600/20' : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                        {song.coverUrl ? <img src={song.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Music className="w-full h-full p-3 opacity-20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold truncate text-sm ${currentSongId === song.id ? 'text-red-400' : ''}`}>{song.title}</h3>
                        <p className="text-[10px] font-bold text-white/40 truncate">{song.artist}</p>
                      </div>
                  {user.role === 'admin' && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); setEditingSong(song); setIsAdminModalOpen(true); }} className="p-1.5 hover:bg-white/10 rounded-full"><Edit2 size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }} className="p-1.5 hover:bg-red-500/20 rounded-full text-red-400"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile View / Desktop Player */}
          <div className="lg:col-span-8 h-full relative">
            <AnimatePresence mode="wait">
              {/* Mobile Library View */}
              {view === 'library' && (
                <motion.div 
                  key="library-mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="lg:hidden h-full flex flex-col p-6 pt-2"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-black tracking-tighter">Tu Biblioteca</h2>
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{songs.length} CANCIONES</div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar pb-24">
                    {songs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-white/20 border-2 border-dashed border-white/5 rounded-[2rem]">
                        <Music size={48} className="mb-4 opacity-20" />
                        <p className="font-medium">Sin música aún</p>
                      </div>
                    ) : (
                      songs.map((song) => (
                        <motion.div 
                          key={song.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => playSong(song.id)}
                          className={`group flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all active:scale-95 ${
                            currentSongId === song.id ? 'bg-red-600/10 border border-red-600/20' : 'bg-white/5 border border-transparent hover:bg-white/10'
                          }`}
                        >
                          <div className="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5 shadow-lg">
                            {song.coverUrl ? (
                              <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20"><Music size={24} /></div>
                            )}
                            {currentSongId === song.id && isPlaying && (
                              <div className="absolute inset-0 bg-red-600/40 backdrop-blur-[2px] flex items-center justify-center">
                                <div className="flex gap-0.5 items-end h-5">
                                  <motion.div animate={{ height: [8, 20, 12] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-white rounded-full"></motion.div>
                                  <motion.div animate={{ height: [12, 8, 20] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-white rounded-full"></motion.div>
                                  <motion.div animate={{ height: [20, 12, 8] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-white rounded-full"></motion.div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold truncate text-base ${currentSongId === song.id ? 'text-red-400' : 'text-white'}`}>{song.title}</h3>
                            <p className="text-xs font-semibold text-white/40 truncate mt-0.5">{song.artist}</p>
                          </div>
                          {user.role === 'admin' && (
                            <div className="flex gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingSong(song); setIsAdminModalOpen(true); }}
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}
                                className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-full text-white/40 hover:text-red-400 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* Player View (Mobile Fullscreen or Desktop Main Area) */}
              {(view === 'player' || windowWidth >= 1024) && (
                <motion.div 
                  key="player"
                  initial={windowWidth < 1024 ? { opacity: 0, y: 40 } : { opacity: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={windowWidth < 1024 ? { opacity: 0, y: 40 } : { opacity: 0 }}
                  className={`h-full flex flex-col p-6 lg:p-8 pt-4 ${windowWidth >= 1024 ? 'bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/5' : ''}`}
                >
                  <div className="flex justify-between items-center mb-4 lg:mb-8">
                    <button onClick={() => setView('library')} className="lg:hidden w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                      <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setShowLyrics(!showLyrics)} 
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          showLyrics ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <Mic2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                    <div className="relative w-full aspect-square max-w-[260px] lg:max-w-[380px] mb-4 lg:mb-6 flex-shrink-0">
                      <motion.div 
                        animate={{ 
                          rotate: isPlaying ? 360 : 0,
                          scale: isPlaying ? 1.05 : 1
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-red-600/10 blur-[80px] rounded-full"
                      />
                      <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 bg-black/40">
                        {currentSong?.coverUrl ? (
                          <img src={currentSong.coverUrl} alt={currentSong?.title} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/10"><Music size={80} /></div>
                        )}
                        
                        <AnimatePresence>
                          {showLyrics && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 20 }}
                              className="absolute inset-0 bg-black/80 backdrop-blur-xl p-6 flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar"
                            >
                              <div className="w-full max-w-xs">
                                <p className="text-base lg:text-lg font-bold leading-relaxed text-white/90 whitespace-pre-wrap">
                                  {currentSong?.lyrics || "No hay letra disponible."}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="w-full text-center mb-4 lg:mb-6 flex-shrink-0">
                      <h2 className="text-2xl lg:text-3xl font-black tracking-tighter mb-1 truncate px-4">{currentSong?.title || "Sin selección"}</h2>
                      <p className="text-sm lg:text-base font-bold text-white/40">{currentSong?.artist || "Selecciona una canción"}</p>
                    </div>

                    <div className="w-full space-y-4 lg:space-y-6 max-w-md flex-shrink-0">
                      <div className="space-y-2 lg:space-y-2">
                        <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="absolute top-0 left-0 h-full bg-red-600"
                            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-widest">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-8 lg:gap-10">
                        <button onClick={prevSong} className="text-white/40 hover:text-white active:scale-90 transition-all"><SkipBack size={32} lg:size={36} fill="currentColor" /></button>
                        <button 
                          onClick={togglePlay}
                          className="w-20 h-20 lg:w-24 lg:h-24 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-90 transition-all shadow-2xl"
                        >
                          {isPlaying ? <Pause size={32} lg:size={40} fill="currentColor" /> : <Play size={32} lg:size={40} fill="currentColor" className="ml-1 lg:ml-2" />}
                        </button>
                        <button onClick={nextSong} className="text-white/40 hover:text-white active:scale-90 transition-all"><SkipForward size={32} lg:size={36} fill="currentColor" /></button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mini Player (Bottom Bar - Mobile Only) */}
        {currentSong && view === 'library' && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            onClick={() => setView('player')}
            className="lg:hidden absolute bottom-6 left-6 right-6 bg-red-600 text-white p-3 rounded-[2rem] flex items-center gap-3 shadow-2xl cursor-pointer active:scale-95 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
              {currentSong.coverUrl ? (
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-black/10 flex items-center justify-center"><Music size={20} /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-sm truncate leading-tight">{currentSong.title}</h4>
              <p className="text-[10px] font-bold opacity-60 truncate uppercase tracking-wider">{currentSong.artist}</p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); prevSong(); }}
                className="p-2 hover:bg-black/10 rounded-full transition-all"
              >
                <SkipBack size={16} fill="currentColor" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/10"
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); nextSong(); }}
                className="p-2 hover:bg-black/10 rounded-full transition-all"
              >
                <SkipForward size={16} fill="currentColor" />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        src={currentSong?.audioUrl}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={nextSong}
      />

      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
                toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-white/10 border-white/10 text-white'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
              <span className="text-sm font-bold">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black mb-2">¿Eliminar canción?</h3>
              <p className="text-white/40 text-sm mb-8 font-medium leading-relaxed">Esta acción no se puede deshacer. La canción se borrará permanentemente de la biblioteca.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 py-4 rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => deleteSong(deleteConfirmId)}
                  className="flex-1 bg-red-600 hover:bg-red-500 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-red-600/20"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="text-xl font-bold">{editingSong ? 'Editar Canción' : 'Subir Nueva Canción'}</h3>
                <button onClick={() => setIsAdminModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpload} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Título</label>
                      <input 
                        name="title"
                        defaultValue={editingSong?.title}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600/50"
                        placeholder="Nombre de la canción"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Artista</label>
                      <input 
                        name="artist"
                        defaultValue={editingSong?.artist}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600/50"
                        placeholder="Nombre del artista"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Archivo de Audio</label>
                      <div className="relative group">
                        <input 
                          name="audio"
                          type="file" 
                          accept="audio/*"
                          required={!editingSong}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full bg-white/5 border border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center group-hover:bg-white/10 transition-all">
                          <Upload size={20} className="text-white/40 mb-2" />
                          <span className="text-xs text-white/40">Seleccionar MP3/WAV</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Portada (Imagen)</label>
                      <div className="relative group">
                        <input 
                          name="cover"
                          type="file" 
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full bg-white/5 border border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center group-hover:bg-white/10 transition-all">
                          <Upload size={20} className="text-white/40 mb-2" />
                          <span className="text-xs text-white/40">Seleccionar JPG/PNG</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Letra</label>
                  <textarea 
                    name="lyrics"
                    defaultValue={editingSong?.lyrics || ''}
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600/50 resize-none"
                    placeholder="Pega aquí la letra de la canción..."
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isUploading}
                    className={`w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        {editingSong ? 'Guardando...' : 'Subiendo...'}
                      </>
                    ) : (
                      editingSong ? 'Guardar Cambios' : 'Subir Canción'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

function formatTime(seconds: number) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
