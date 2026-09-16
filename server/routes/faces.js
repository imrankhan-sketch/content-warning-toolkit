const express = require('express');
const crypto = require('crypto');
const { transact } = require('../lib/db');
const { isValidDescriptor, findBestMatch } = require('../lib/faceMatch');

const router = express.Router();

// Registers a face detected client-side (photoId, descriptor, box) and
// clusters it against existing faces to find or create the matching person.
router.post('/', async (req, res) => {
  const { photoId, descriptor, box } = req.body || {};

  if (typeof photoId !== 'string') {
    return res.status(400).json({ error: 'photoId is required' });
  }
  if (!isValidDescriptor(descriptor)) {
    return res.status(400).json({ error: 'descriptor must be an array of 128 numbers' });
  }
  if (
    !box ||
    typeof box.x !== 'number' ||
    typeof box.y !== 'number' ||
    typeof box.width !== 'number' ||
    typeof box.height !== 'number'
  ) {
    return res.status(400).json({ error: 'box {x,y,width,height} is required' });
  }

  const result = await transact((db) => {
    const photo = db.photos.find((p) => p.id === photoId);
    if (!photo) return { error: 'Photo not found', status: 404 };

    const match = findBestMatch(descriptor, db.faces);
    let personId;
    if (match) {
      personId = match.face.personId;
    } else {
      const person = {
        id: crypto.randomUUID(),
        name: null,
        createdAt: Date.now(),
      };
      db.people.push(person);
      personId = person.id;
    }

    const face = {
      id: crypto.randomUUID(),
      photoId,
      personId,
      descriptor,
      box,
      createdAt: Date.now(),
    };
    db.faces.push(face);
    return { face };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.face);
});

// Reassigns a face to a different (existing) person, or clears personId to
// mark it as "not a person" so it's excluded from matching and people views.
router.patch('/:id', async (req, res) => {
  const { personId } = req.body || {};
  const result = await transact((db) => {
    const face = db.faces.find((f) => f.id === req.params.id);
    if (!face) return { error: 'Face not found', status: 404 };
    if (personId !== null && personId !== undefined) {
      if (!db.people.some((p) => p.id === personId)) {
        return { error: 'Target person not found', status: 400 };
      }
      face.personId = personId;
    } else {
      face.personId = null;
    }
    return { face };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result.face);
});

router.delete('/:id', async (req, res) => {
  const removed = await transact((db) => {
    const idx = db.faces.findIndex((f) => f.id === req.params.id);
    if (idx === -1) return false;
    db.faces.splice(idx, 1);
    return true;
  });
  if (!removed) return res.status(404).json({ error: 'Face not found' });
  res.status(204).end();
});

module.exports = router;
