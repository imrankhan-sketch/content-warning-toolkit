// face-api.js descriptors are 128-d float vectors. 0.6 euclidean distance is
// the standard match threshold used by face-api.js / dlib (faces of the same
// person are usually well under 0.6; different people are usually well over).
const MATCH_THRESHOLD = 0.6;

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function isValidDescriptor(descriptor) {
  return (
    Array.isArray(descriptor) &&
    descriptor.length === 128 &&
    descriptor.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

// Finds the best-matching existing face (if any) for a new descriptor,
// searching only among faces that still belong to a person (not ignored).
function findBestMatch(descriptor, faces) {
  let best = null;
  let bestDistance = Infinity;
  for (const face of faces) {
    if (!face.personId) continue;
    const distance = euclideanDistance(descriptor, face.descriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = face;
    }
  }
  if (best && bestDistance <= MATCH_THRESHOLD) {
    return { face: best, distance: bestDistance };
  }
  return null;
}

module.exports = { MATCH_THRESHOLD, euclideanDistance, isValidDescriptor, findBestMatch };
