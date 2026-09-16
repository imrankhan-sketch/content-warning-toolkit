const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'db.json');

const EMPTY_DB = { photos: [], faces: [], people: [] };

function load() {
  if (!fs.existsSync(DB_PATH)) {
    save(EMPTY_DB);
    return structuredClone(EMPTY_DB);
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  if (!raw.trim()) return structuredClone(EMPTY_DB);
  return JSON.parse(raw);
}

function save(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Serializes read-modify-write cycles so concurrent requests can't clobber each other.
let queue = Promise.resolve();
function transact(fn) {
  const result = queue.then(() => {
    const db = load();
    const value = fn(db);
    save(db);
    return value;
  });
  queue = result.catch(() => {});
  return result;
}

module.exports = { load, save, transact };
