import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const db = new Database("spotihermes.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    coverUrl TEXT,
    audioUrl TEXT NOT NULL,
    lyrics TEXT,
    authorId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const app = express();
const PORT = 3000;

app.use(express.json());

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Setup multer with Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith('audio/');
    return {
      folder: isAudio ? 'spotihermes/audio' : 'spotihermes/covers',
      resource_type: isAudio ? 'video' : 'image', // Cloudinary uses 'video' for audio files
      public_id: Date.now() + "-" + path.parse(file.originalname).name,
    };
  },
});

const upload = multer({ storage });

// Serve uploads statically
app.use("/uploads", express.static("uploads"));

// Hardcoded users as requested
const USERS = {
  admin: { username: "hermesherasme", password: "herasmehermes18", role: "admin" },
  user: { username: "karendesiree", password: "1132026", role: "user" },
};

// API Routes
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = Object.values(USERS).find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    res.json({ success: true, user: { username: user.username, role: user.role } });
  } else {
    res.status(401).json({ success: false, message: "Credenciales incorrectas" });
  }
});

app.get("/api/songs", (req, res) => {
  const songs = db.prepare("SELECT * FROM songs ORDER BY id ASC").all();
  const formattedSongs = songs.map((s: any) => ({
    ...s,
    id: s.id.toString()
  }));
  res.json(formattedSongs);
});

app.post("/api/songs", upload.fields([{ name: "audio" }, { name: "cover" }]), (req, res) => {
  try {
    const { title, artist, lyrics, authorId } = req.body;
    const files = req.files as any;
    
    const audioUrl = files.audio ? files.audio[0].path : null;
    const coverUrl = files.cover ? files.cover[0].path : null;

    if (!audioUrl) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    const info = db.prepare(
      "INSERT INTO songs (title, artist, coverUrl, audioUrl, lyrics, authorId) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(title, artist, coverUrl, audioUrl, lyrics, authorId);

    const newId = Number(info.lastInsertRowid);
    res.json({ id: newId.toString(), title, artist, coverUrl, audioUrl, lyrics, authorId });
  } catch (err) {
    console.error("Error in POST /api/songs:", err);
    res.status(500).json({ error: "Error al guardar la canción" });
  }
});

app.put("/api/songs/:id", upload.fields([{ name: "audio" }, { name: "cover" }]), (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, lyrics } = req.body;
    const files = req.files as any;

    const currentSong = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as any;
    if (!currentSong) return res.status(404).json({ error: "Song not found" });

    const audioUrl = files.audio ? files.audio[0].path : currentSong.audioUrl;
    const coverUrl = files.cover ? files.cover[0].path : currentSong.coverUrl;

    db.prepare(
      "UPDATE songs SET title = ?, artist = ?, coverUrl = ?, audioUrl = ?, lyrics = ? WHERE id = ?"
    ).run(title, artist, coverUrl, audioUrl, lyrics, id);

    res.json({ id: id.toString(), title, artist, coverUrl, audioUrl, lyrics });
  } catch (err) {
    console.error("Error in PUT /api/songs:", err);
    res.status(500).json({ error: "Error al actualizar la canción" });
  }
});

app.delete("/api/songs/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM songs WHERE id = ?").run(id);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
