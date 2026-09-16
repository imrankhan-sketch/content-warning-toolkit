const express = require('express');
const { transact } = require('../lib/db');

const router = express.Router();

function buildSummary(db) {
  return db.people
    .map((person) => {
      const faces = db.faces.filter((f) => f.personId === person.id);
      if (faces.length === 0) return null;
      const cover = faces[0];
      return {
        id: person.id,
        name: person.name,
        faceCount: faces.length,
        photoCount: new Set(faces.map((f) => f.photoId)).size,
        cover: { photoId: cover.photoId, box: cover.box },
        createdAt: person.createdAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.faceCount - a.faceCount);
}

router.get('/', async (req, res) => {
  const db = await transact((db) => db);
  res.json(buildSummary(db));
});

router.get('/:id/photos', async (req, res) => {
  const db = await transact((db) => db);
  const faceIds = db.faces.filter((f) => f.personId === req.params.id);
  const photoIds = new Set(faceIds.map((f) => f.photoId));
  const photos = db.photos.filter((p) => photoIds.has(p.id));
  res.json(photos.sort((a, b) => b.uploadedAt - a.uploadedAt));
});

router.patch('/:id', async (req, res) => {
  const { name } = req.body || {};
  const result = await transact((db) => {
    const person = db.people.find((p) => p.id === req.params.id);
    if (!person) return { error: 'Person not found', status: 404 };
    person.name = typeof name === 'string' ? name.trim().slice(0, 100) || null : null;
    return { person };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result.person);
});

// Merges `sourceId` into `targetId`: every face belonging to source is
// reassigned to target, and the now-empty source person is dropped.
router.post('/merge', async (req, res) => {
  const { sourceId, targetId } = req.body || {};
  if (!sourceId || !targetId || sourceId === targetId) {
    return res.status(400).json({ error: 'sourceId and targetId (distinct) are required' });
  }
  const result = await transact((db) => {
    const source = db.people.find((p) => p.id === sourceId);
    const target = db.people.find((p) => p.id === targetId);
    if (!source || !target) return { error: 'Person not found', status: 404 };
    db.faces.forEach((f) => {
      if (f.personId === sourceId) f.personId = targetId;
    });
    db.people = db.people.filter((p) => p.id !== sourceId);
    return { target };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result.target);
});

module.exports = router;
