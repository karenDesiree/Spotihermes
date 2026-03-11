import "dotenv/config";
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

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/api/health", async (req, res) => {
  let cloudinaryStatus = "unknown";
  try {
    const result = await cloudinary.api.ping();
    cloudinaryStatus = result.status === "ok" ? "connected" : "error";
  } catch (err: any) {
    cloudinaryStatus = `error: ${err.message}`;
  }

  res.json({ 
    status: "ok", 
    cloudinaryConfigured: !!process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryStatus
  });
});

// Configure Cloudinary
console.log("Configurando Cloudinary con:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "PRESENT" : "MISSING",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "PRESENT" : "MISSING",
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn("⚠️ WARNING: Cloudinary credentials are not fully configured. Uploads will fail.");
}

// Setup multer with Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    try {
      console.log("Preparando subida para archivo:", file.originalname, "mimetype:", file.mimetype);
      const isAudio = file.mimetype.startsWith('audio/');
      const params = {
        folder: isAudio ? 'spotihermes/audio' : 'spotihermes/covers',
        resource_type: 'auto', // Let Cloudinary decide
        public_id: Date.now() + "-" + path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_'),
      };
      console.log("Cloudinary params:", params);
      return params;
    } catch (err) {
      console.error("Error en params de CloudinaryStorage:", err);
      throw err;
    }
  },
});

const upload = multer({ storage });
const uploadMiddleware = upload.fields([{ name: "audio" }, { name: "cover" }]);

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

app.post("/api/songs", (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error("Multer/Cloudinary Error during POST:", err);
      return res.status(500).json({ 
        error: "Error al subir archivos a Cloudinary", 
        details: err.message || "Error desconocido en Multer/Cloudinary",
        fullError: process.env.NODE_ENV === 'development' ? err : undefined,
        hint: "Verifica que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET estén configurados en los ajustes."
      });
    }
    next();
  });
}, (req, res) => {
  try {
    console.log("POST /api/songs - Procesando datos");
    console.log("Body recibido:", req.body);
    const { title, artist, lyrics, authorId } = req.body;
    const files = req.files as any;
    
    const audioUrl = files.audio ? files.audio[0].path : null;
    const coverUrl = files.cover ? files.cover[0].path : null;

    console.log("Datos:", { title, artist, audioUrl, coverUrl });

    if (!audioUrl) {
      console.error("Error: No hay archivo de audio");
      return res.status(400).json({ error: "Audio file is required" });
    }

    const info = db.prepare(
      "INSERT INTO songs (title, artist, coverUrl, audioUrl, lyrics, authorId) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(title, artist, coverUrl, audioUrl, lyrics, authorId);

    console.log("Canción insertada con ID:", info.lastInsertRowid);

    const newId = Number(info.lastInsertRowid);
    res.json({ id: newId.toString(), title, artist, coverUrl, audioUrl, lyrics, authorId });
  } catch (err) {
    console.error("Error in POST /api/songs:", err);
    res.status(500).json({ error: "Error al guardar la canción en la base de datos" });
  }
});

app.put("/api/songs/:id", (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error("Multer/Cloudinary Error during PUT:", err);
      return res.status(500).json({ 
        error: "Error al subir archivos a Cloudinary", 
        details: err.message 
      });
    }
    next();
  });
}, (req, res) => {
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
  const vite = process.env.NODE_ENV !== "production" 
    ? await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      })
    : null;

  if (vite) {
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Cloudinary Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME || 'Not set'}`);
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });
}

startServer();
