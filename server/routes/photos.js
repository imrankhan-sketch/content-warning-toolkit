const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { transact } = require('../lib/db');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.get('/', async (req, res) => {
  const db = await transact((db) => db);
  res.json(db.photos.slice().sort((a, b) => b.uploadedAt - a.uploadedAt));
});

router.post('/upload', (req, res) => {
  upload.array('photos', 50)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const created = await transact((db) => {
      const records = req.files.map((file) => {
        const photo = {
          id: crypto.randomUUID(),
          filename: file.filename,
          originalName: file.originalname,
          url: `/uploads/${file.filename}`,
          uploadedAt: Date.now(),
          processed: false,
        };
        db.photos.push(photo);
        return photo;
      });
      return records;
    });
    res.status(201).json(created);
  });
});

router.delete('/:id', async (req, res) => {
  const result = await transact((db) => {
    const idx = db.photos.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return null;
    const [photo] = db.photos.splice(idx, 1);
    db.faces = db.faces.filter((f) => f.photoId !== photo.id);
    return photo;
  });
  if (!result) return res.status(404).json({ error: 'Photo not found' });
  fs.unlink(path.join(UPLOAD_DIR, result.filename), () => {});
  res.status(204).end();
});

router.get('/:id/faces', async (req, res) => {
  const db = await transact((db) => db);
  const faces = db.faces.filter((f) => f.photoId === req.params.id);
  res.json(faces);
});

router.post('/:id/processed', async (req, res) => {
  const photo = await transact((db) => {
    const photo = db.photos.find((p) => p.id === req.params.id);
    if (photo) photo.processed = true;
    return photo;
  });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  res.json(photo);
});

module.exports = router;
