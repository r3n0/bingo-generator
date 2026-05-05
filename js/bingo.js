/**
 * bingo.js — Core bingo card generation logic
 *
 * Exports:
 *   buildPool(images, numbers, words) → array of pool items
 *   generateCards(pool, count, useFreeSpace) → array of card data (5x5 grids)
 */

/**
 * Shuffles an array in-place using Fisher-Yates and returns it.
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a unified pool from images, numbers and words.
 * Each item: { type: 'image'|'number'|'word', value: string }
 *
 * @param {Array<{id,dataUrl}>} images
 * @param {number}              numberRange  - e.g. 30 → [1..30]
 * @param {string}              wordsRaw     - comma-separated words
 * @returns {Array}
 */
export function buildPool(images, numberRange, wordsRaw) {
  const pool = [];

  // Images
  for (const img of images) {
    pool.push({ type: 'image', value: img.dataUrl, id: img.id });
  }

  // Numbers
  const n = parseInt(numberRange, 10);
  if (!isNaN(n) && n > 0) {
    for (let i = 1; i <= n; i++) {
      pool.push({ type: 'number', value: String(i) });
    }
  }

  // Words
  if (wordsRaw && wordsRaw.trim()) {
    const words = wordsRaw
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);
    for (const w of words) {
      pool.push({ type: 'word', value: w });
    }
  }

  return pool;
}

/**
 * Generates a stable hash string for a card grid (for duplicate detection).
 * @param {Array} grid - flat array of 25 cell items
 * @returns {string}
 */
function hashCard(grid) {
  return grid.map(cell => {
    if (!cell) return 'FREE';
    return `${cell.type}:${cell.value}`;
  }).join('|');
}

/**
 * Generates `count` unique bingo cards (5×5 grids) from the pool.
 * Each card is a flat array of 25 items (index 12 is the free space if enabled).
 *
 * @param {Array}   pool
 * @param {number}  count
 * @param {boolean} useFreeSpace
 * @returns {{ cards: Array<Array>, error: string|null }}
 */
export function generateCards(pool, count, useFreeSpace) {
  const cellsPerCard = 25;
  const requiredCells = useFreeSpace ? cellsPerCard - 1 : cellsPerCard;

  if (pool.length < requiredCells) {
    return {
      cards: [],
      error: `El pool tiene solo ${pool.length} elementos. Se necesitan al menos ${requiredCells} para llenar una tarjeta (${useFreeSpace ? '24 + espacio libre' : '25'}).`
    };
  }

  const cards   = [];
  const seen    = new Set();
  const maxTries = count * 200;
  let   tries    = 0;

  while (cards.length < count && tries < maxTries) {
    tries++;
    const shuffled = shuffle(pool).slice(0, requiredCells);
    let grid;

    if (useFreeSpace) {
      // Insert free space at position 12 (center of 5×5)
      grid = [
        ...shuffled.slice(0, 12),
        null,
        ...shuffled.slice(12),
      ];
    } else {
      grid = shuffled.slice(0, 25);
    }

    const hash = hashCard(grid);
    if (!seen.has(hash)) {
      seen.add(hash);
      cards.push(grid);
    }
  }

  if (cards.length < count) {
    return {
      cards,
      error: `Solo se pudieron generar ${cards.length} tarjetas únicas con los datos actuales (pool de ${pool.length} elementos).`
    };
  }

  return { cards, error: null };
}
