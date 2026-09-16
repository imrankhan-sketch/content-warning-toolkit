const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

const state = {
  photos: [],
  people: [],
  modelsReady: false,
};

const el = {
  status: document.getElementById('status'),
  fileInput: document.getElementById('fileInput'),
  photoGrid: document.getElementById('photoGrid'),
  libraryEmpty: document.getElementById('libraryEmpty'),
  peopleGrid: document.getElementById('peopleGrid'),
  peopleEmpty: document.getElementById('peopleEmpty'),
  personPhotoGrid: document.getElementById('personPhotoGrid'),
  personPhotosTitle: document.getElementById('personPhotosTitle'),
  backToPeople: document.getElementById('backToPeople'),
  modal: document.getElementById('photoModal'),
  modalImage: document.getElementById('modalImage'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalFaces: document.getElementById('modalFaces'),
  closeModal: document.getElementById('closeModal'),
};

function setStatus(text) {
  if (!text) {
    el.status.classList.add('hidden');
    el.status.textContent = '';
    return;
  }
  el.status.classList.remove('hidden');
  el.status.textContent = text;
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- tabs ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(name).classList.add('active');
}

// ---------- data loading ----------

async function refreshPhotos() {
  state.photos = await api('/photos');
  renderLibrary();
}

async function refreshPeople() {
  state.people = await api('/people');
  renderPeople();
}

function photoById(id) {
  return state.photos.find((p) => p.id === id);
}

// ---------- library view ----------

function renderLibrary() {
  el.libraryEmpty.classList.toggle('hidden', state.photos.length > 0);
  el.photoGrid.innerHTML = '';
  for (const photo of state.photos) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.url}" alt="${escapeHtml(photo.originalName)}" loading="lazy" />
      ${!photo.processed ? '<div class="processing-spinner">Scanning…</div>' : ''}
    `;
    card.addEventListener('click', () => openPhotoModal(photo));
    el.photoGrid.appendChild(card);
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- people view ----------

function renderPeople() {
  el.peopleEmpty.classList.toggle('hidden', state.people.length > 0);
  el.peopleGrid.innerHTML = '';
  for (const person of state.people) {
    const card = document.createElement('div');
    card.className = 'person-card';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    thumbWrap.appendChild(canvas);
    card.appendChild(thumbWrap);
    drawFaceThumb(canvas, person.cover);

    const nameInput = document.createElement('input');
    nameInput.className = 'person-name';
    nameInput.placeholder = 'Unnamed';
    nameInput.value = person.name || '';
    nameInput.addEventListener('click', (e) => e.stopPropagation());
    nameInput.addEventListener('change', async () => {
      await api(`/people/${person.id}`, { method: 'PATCH', body: { name: nameInput.value } });
      person.name = nameInput.value.trim() || null;
    });
    card.appendChild(nameInput);

    const count = document.createElement('div');
    count.className = 'person-count';
    count.textContent = `${person.photoCount} photo${person.photoCount === 1 ? '' : 's'}`;
    card.appendChild(count);

    const others = state.people.filter((p) => p.id !== person.id);
    if (others.length > 0) {
      const mergeSelect = document.createElement('select');
      mergeSelect.innerHTML =
        '<option value="">Merge into…</option>' +
        others.map((p) => `<option value="${p.id}">${escapeHtml(p.name || 'Unnamed')}</option>`).join('');
      mergeSelect.addEventListener('click', (e) => e.stopPropagation());
      mergeSelect.addEventListener('change', async () => {
        const targetId = mergeSelect.value;
        if (!targetId) return;
        const target = others.find((p) => p.id === targetId);
        if (!confirm(`Merge "${person.name || 'Unnamed'}" into "${target.name || 'Unnamed'}"?`)) {
          mergeSelect.value = '';
          return;
        }
        await api('/people/merge', { method: 'POST', body: { sourceId: person.id, targetId } });
        await refreshPeople();
      });
      card.appendChild(mergeSelect);
    }

    card.addEventListener('click', () => openPersonPhotos(person));
    el.peopleGrid.appendChild(card);
  }
}

function drawFaceThumb(canvas, cover) {
  const photo = photoById(cover.photoId);
  if (!photo) return;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const { x, y, width, height } = cover.box;
    const pad = Math.max(width, height) * 0.15;
    const sx = Math.max(0, x - pad);
    const sy = Math.max(0, y - pad);
    const sw = Math.min(img.naturalWidth - sx, width + pad * 2);
    const sh = Math.min(img.naturalHeight - sy, height + pad * 2);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  };
  img.src = photo.url;
}

async function openPersonPhotos(person) {
  el.personPhotosTitle.textContent = person.name || 'Unnamed person';
  const photos = await api(`/people/${person.id}/photos`);
  el.personPhotoGrid.innerHTML = '';
  for (const photo of photos) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `<img src="${photo.url}" alt="${escapeHtml(photo.originalName)}" loading="lazy" />`;
    card.addEventListener('click', () => openPhotoModal(photo));
    el.personPhotoGrid.appendChild(card);
  }
  switchTab('personPhotos');
}

el.backToPeople.addEventListener('click', () => switchTab('people'));

// ---------- photo modal ----------

async function openPhotoModal(photo) {
  el.modalImage.src = photo.url;
  el.modalFaces.innerHTML = '';
  el.modalOverlay.innerHTML = '';
  el.modal.classList.remove('hidden');

  const faces = await api(`/photos/${photo.id}/faces`);

  const drawOverlay = () => {
    const img = el.modalImage;
    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;
    el.modalOverlay.setAttribute('viewBox', `0 0 ${img.clientWidth} ${img.clientHeight}`);
    el.modalOverlay.innerHTML = faces
      .map((f) => {
        const x = f.box.x * scaleX;
        const y = f.box.y * scaleY;
        const w = f.box.width * scaleX;
        const h = f.box.height * scaleY;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#6c8cff" stroke-width="2" rx="4" />`;
      })
      .join('');
  };

  if (el.modalImage.complete) drawOverlay();
  else el.modalImage.onload = drawOverlay;

  for (const face of faces) {
    const person = state.people.find((p) => p.id === face.personId);
    const chip = document.createElement('div');
    chip.className = 'face-chip';
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    chip.appendChild(canvas);
    drawFaceThumb(canvas, { photoId: photo.id, box: face.box });
    const label = document.createElement('span');
    label.textContent = person ? person.name || 'Unnamed' : 'Ignored';
    chip.appendChild(label);
    el.modalFaces.appendChild(chip);
  }
}

el.closeModal.addEventListener('click', closeModal);
el.modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
function closeModal() {
  el.modal.classList.add('hidden');
}

// ---------- upload + face detection pipeline ----------

el.fileInput.addEventListener('change', async () => {
  const files = Array.from(el.fileInput.files || []);
  if (files.length === 0) return;
  el.fileInput.value = '';

  setStatus(`Uploading ${files.length} photo${files.length === 1 ? '' : 's'}…`);
  const formData = new FormData();
  files.forEach((f) => formData.append('photos', f));

  let uploaded;
  try {
    const res = await fetch('/api/photos/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
    uploaded = await res.json();
  } catch (e) {
    setStatus(`Upload failed: ${e.message}`);
    setTimeout(() => setStatus(null), 4000);
    return;
  }

  await refreshPhotos();
  await processPending();
});

async function ensureModelsLoaded() {
  if (state.modelsReady) return;
  setStatus('Loading face recognition models…');
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  state.modelsReady = true;
}

async function processPending() {
  const pending = state.photos.filter((p) => !p.processed);
  if (pending.length === 0) {
    setStatus(null);
    return;
  }

  await ensureModelsLoaded();

  for (let i = 0; i < pending.length; i++) {
    const photo = pending[i];
    setStatus(`Detecting faces… (${i + 1}/${pending.length})`);
    try {
      await processPhoto(photo);
    } catch (e) {
      console.error(`Failed to process ${photo.originalName}`, e);
    }
  }

  setStatus(null);
  await Promise.all([refreshPhotos(), refreshPeople()]);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function processPhoto(photo) {
  const img = await loadImage(photo.url);
  const detections = await faceapi
    .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  for (const det of detections) {
    const box = det.detection.box;
    await api('/faces', {
      method: 'POST',
      body: {
        photoId: photo.id,
        descriptor: Array.from(det.descriptor),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      },
    });
  }

  await api(`/photos/${photo.id}/processed`, { method: 'POST' });
}

// ---------- init ----------

(async function init() {
  await refreshPhotos();
  await refreshPeople();
  processPending();
})();
