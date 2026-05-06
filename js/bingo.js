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
 * @returns {Array}
 */
export function buildPool(images, numberRange) {
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

  return pool;
}

/**
 * Generates a stable hash string for a card grid (for duplicate detection).
 * @param {Array} grid - flat array of 25 cell items
 * @returns {string}
 */
function hashCard(grid) {
  return grid.map(cell => `${cell.type}:${cell.value}`).join('|');
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
export function generateCards(pool, count) {
  const imagesPool  = pool.filter(item => item.type === 'image');
  const numbersPool = pool.filter(item => item.type === 'number');

  if (imagesPool.length === 0) {
    return {
      cards: [],
      error: 'Debe subir al menos 1 imagen a la galería para generar las tarjetas.'
    };
  }

  if (numbersPool.length < 23) {
    return {
      cards: [],
      error: `El rango de números es muy pequeño. Se necesitan al menos 23 números (actual: ${numbersPool.length}).`
    };
  }

  const cards   = [];
  const seen    = new Set();
  const maxTries = count * 200;
  let   tries    = 0;

  while (cards.length < count && tries < maxTries) {
    tries++;
    
    // Pick exactly 2 images (unique if possible, otherwise repeat the single one)
    let twoImages;
    if (imagesPool.length >= 2) {
      twoImages = shuffle(imagesPool).slice(0, 2);
    } else {
      twoImages = [imagesPool[0], imagesPool[0]];
    }
    
    // Pick 23 random numbers
    const twentyThreeNumbers = shuffle(numbersPool).slice(0, 23);
    
    // Combine and shuffle to form the 25-cell grid
    const grid = shuffle([...twoImages, ...twentyThreeNumbers]);

    const hash = hashCard(grid);
    if (!seen.has(hash)) {
      seen.add(hash);
      cards.push(grid);
    }
  }

  if (cards.length < count) {
    return {
      cards,
      error: `Solo se pudieron generar ${cards.length} tarjetas únicas con los datos actuales.`
    };
  }

  return { cards, error: null };
}
