import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import multer from "multer";

const db = new Database("spotihermes.db");
// Database initialized

// Ensure uploads directory exists
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    coverUrl TEXT,
    audioUrl TEXT NOT NULL,
    lyrics TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const app = express();
const PORT = 3000;

app.use(express.json());

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
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
  res.json(songs);
});

app.post("/api/songs", upload.fields([{ name: "audio" }, { name: "cover" }]), (req, res) => {
  try {
    console.log("POST /api/songs - Body:", req.body);
    console.log("POST /api/songs - Files:", req.files);
    const { title, artist, lyrics } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    const audioUrl = files.audio ? `/uploads/${files.audio[0].filename}` : null;
    const coverUrl = files.cover ? `/uploads/${files.cover[0].filename}` : null;

    if (!audioUrl) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    const info = db.prepare(
      "INSERT INTO songs (title, artist, coverUrl, audioUrl, lyrics) VALUES (?, ?, ?, ?, ?)"
    ).run(title, artist, coverUrl, audioUrl, lyrics);

    const newId = Number(info.lastInsertRowid);
    res.json({ id: newId, title, artist, coverUrl, audioUrl, lyrics });
  } catch (err) {
    console.error("Error in POST /api/songs:", err);
    res.status(500).json({ error: "Error al guardar la canción" });
  }
});

app.put("/api/songs/:id", upload.fields([{ name: "audio" }, { name: "cover" }]), (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, lyrics } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const currentSong = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as any;
    if (!currentSong) return res.status(404).json({ error: "Song not found" });

    const audioUrl = files.audio ? `/uploads/${files.audio[0].filename}` : currentSong.audioUrl;
    const coverUrl = files.cover ? `/uploads/${files.cover[0].filename}` : currentSong.coverUrl;

    db.prepare(
      "UPDATE songs SET title = ?, artist = ?, coverUrl = ?, audioUrl = ?, lyrics = ? WHERE id = ?"
    ).run(title, artist, coverUrl, audioUrl, lyrics, id);

    res.json({ id, title, artist, coverUrl, audioUrl, lyrics });
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
