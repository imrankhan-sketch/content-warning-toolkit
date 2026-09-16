# FaceVault

A self-hosted photo library with on-device face detection and recognition —
in the spirit of [Tonfotos](https://tonfotos.com/): import photos, and the
app automatically finds faces, groups them by person, and lets you browse
your library by who's in each picture.

> **Note:** this repository previously held unrelated placeholder content
> (a "Content Warning Hack" README advertising a download from an external
> site). That page had no source code behind it and matched a pattern
> commonly used to distribute malware disguised as game cheats/hacks, so it
> has been replaced with this project.

## How it works

- **Detection & recognition run entirely in your browser** using
  [face-api.js](https://github.com/justadudewhohacks/face-api.js)
  (TensorFlow.js). No photo or face data is ever sent to a third party —
  only to your own server.
- The Node/Express backend stores uploaded photos on disk and persists face
  descriptors, clustering, and person labels in a small JSON database.
- New faces are matched against previously seen faces by descriptor
  distance (a standard 128-d face embedding). A close match joins an
  existing person; otherwise a new person is created automatically.

## Features

- Upload and browse a photo library ("Library" tab).
- Automatic face detection + clustering into people ("People" tab).
- Rename a detected person; click their card to see every photo they're in.
- Merge two people who got split into separate clusters.
- Click a photo to see bounding boxes over each detected face.

## Getting started

```bash
npm install
npm start
```

Then open http://localhost:3000, click **Add Photos**, and upload some
images. The first upload will download the face-api.js models from a CDN
(a few dozen MB, cached by the browser afterward) and process each photo
in the background.

## Project layout

```
server/          Express app: uploads, JSON "database", face-matching, REST API
public/          Frontend: face-api.js runs here, in the browser
data/db.json     Photos / faces / people (created automatically, gitignored)
uploads/         Uploaded photo files (created automatically, gitignored)
```

## Notes & limitations

- This is a single-user, local-first tool with **no authentication** —
  don't expose it directly to the internet without adding your own auth
  layer in front of it.
- Face matching uses a fixed distance threshold rather than a tunable
  confidence slider; very similar-looking relatives may get merged into
  one person, and lighting/angle extremes may split one person into two
  (use **Merge into…** on a person card to fix the latter).

## License

MIT
