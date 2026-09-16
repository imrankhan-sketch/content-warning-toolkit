const express = require('express');
const path = require('path');

const photosRouter = require('./routes/photos');
const facesRouter = require('./routes/faces');
const peopleRouter = require('./routes/people');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/photos', photosRouter);
app.use('/api/faces', facesRouter);
app.use('/api/people', peopleRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FaceVault running at http://localhost:${PORT}`);
});
