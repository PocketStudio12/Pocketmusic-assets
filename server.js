const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Create folders automatically
[
  "uploads",
  "uploads/images",
  "uploads/songs"
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Static files
app.use("/uploads", express.static("uploads"));
app.use(express.static("."));

const SONG_FILE = "songs.json";
const CAT_FILE = "categories.json";

if (!fs.existsSync(SONG_FILE)) {
  fs.writeFileSync(SONG_FILE, "[]");
}

if (!fs.existsSync(CAT_FILE)) {
  fs.writeFileSync(
    CAT_FILE,
    JSON.stringify(["Bengali", "Hindi"], null, 2)
  );
}

// Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) {
      cb(null, "uploads/images");
    } else {
      cb(null, "uploads/songs");
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

function getSongs() {
  return JSON.parse(fs.readFileSync(SONG_FILE, "utf8"));
}

function saveSongs(data) {
  fs.writeFileSync(
    SONG_FILE,
    JSON.stringify(data, null, 2)
  );
}

function getBaseUrl(req) {
  return req.protocol + "://" + req.get("host");
}

/* =========================
   CATEGORIES
========================= */

app.get("/api/categories", (req, res) => {
  res.json(JSON.parse(fs.readFileSync(CAT_FILE)));
});

app.post("/api/category/create", (req, res) => {
  const cats = JSON.parse(fs.readFileSync(CAT_FILE));

  if (!cats.includes(req.body.name)) {
    cats.push(req.body.name);
  }

  fs.writeFileSync(
    CAT_FILE,
    JSON.stringify(cats, null, 2)
  );

  res.json({ ok: true });
});

/* =========================
   UPLOAD SONG
========================= */

app.post(
  "/api/song/upload",
  upload.fields([
    { name: "imageFile" },
    { name: "musicFile" }
  ]),
  (req, res) => {
    try {
      const songs = getSongs();

      const BASE_URL = getBaseUrl(req);

      let image = req.body.imageLink || "";
      let music = req.body.musicLink || "";

      if (
        req.files &&
        req.files.imageFile &&
        req.files.imageFile.length
      ) {
        image =
          BASE_URL +
          "/uploads/images/" +
          req.files.imageFile[0].filename;
      }

      if (
        req.files &&
        req.files.musicFile &&
        req.files.musicFile.length
      ) {
        music =
          BASE_URL +
          "/uploads/songs/" +
          req.files.musicFile[0].filename;
      }

      const song = {
        id: Date.now(),
        name: req.body.name || "",
        singer: req.body.singer || "",
        category: req.body.category || "Other",
        image,
        music
      };

      songs.push(song);
      saveSongs(songs);

      res.json({
        ok: true,
        song
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err.message
      });
    }
  }
);

/* =========================
   SONG LIST
========================= */

app.get("/api/songs", (req, res) => {
  res.json(getSongs());
});

/* =========================
   DELETE SONG
========================= */

app.delete("/api/song/:id", (req, res) => {
  const id = Number(req.params.id);

  let songs = getSongs();

  const song = songs.find(s => s.id === id);

  if (song) {
    try {
      if (song.image.includes("/uploads/images/")) {
        const img = song.image.split("/uploads/images/")[1];
        const imgPath = path.join(
          "uploads/images",
          img
        );

        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }

      if (song.music.includes("/uploads/songs/")) {
        const mp3 = song.music.split("/uploads/songs/")[1];
        const mp3Path = path.join(
          "uploads/songs",
          mp3
        );

        if (fs.existsSync(mp3Path)) {
          fs.unlinkSync(mp3Path);
        }
      }
    } catch {}
  }

  songs = songs.filter(s => s.id !== id);

  saveSongs(songs);

  res.json({ ok: true });
});

/* =========================
   SEARCH
========================= */

app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  const songs = getSongs();

  res.json(
    songs.filter(song =>
      song.name.toLowerCase().includes(q)
    )
  );
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.send("Pocket Studio Music API Running");
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 20331;

app.listen(PORT, () => {
  console.log(
    `Music API running on port ${PORT}`
  );
});