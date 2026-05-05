/**
 * pdf.js — PDF export logic using jsPDF
 *
 * Print-friendly: white background, bold numbers, square cells.
 * Layout: 2 columns × 2 rows = 4 cards per A4 page.
 */

/* global jspdf */

// ── Page geometry ─────────────────────────────────────────────────────────
const PAGE_W = 210;   // A4 width  mm
const PAGE_H = 297;   // A4 height mm

const MARGIN_X = 10; // left/right page margin
const MARGIN_Y = 10; // top/bottom page margin
const COL_GAP = 6;  // horizontal gap between the two columns
const ROW_GAP = 8;  // vertical   gap between the two rows

// 2 columns, 2 rows
const CARD_W = (PAGE_W - MARGIN_X * 2 - COL_GAP) / 2;   // ≈ 92 mm
const CARD_H = (PAGE_H - MARGIN_Y * 2 - ROW_GAP) / 2;   // ≈ 134.5 mm

// ── Card internal geometry ────────────────────────────────────────────────
const TITLE_H  = 10;  // coloured title bar height
const HEADER_H = 12;  // BINGO letter row — increased for bigger letters

// Remaining height for the 5×5 grid
const CONTENT_H = CARD_H - TITLE_H - HEADER_H;  // ≈ 116.5 mm

// Force square cells — take the smaller of width-based and height-based sizes
const CELL_W_RAW = CARD_W / 5;           // ≈ 18.4 mm
const CELL_H_RAW = CONTENT_H / 5;        // ≈ 23.3 mm
const CELL_SIZE = Math.min(CELL_W_RAW, CELL_H_RAW);  // ≈ 18.4 mm (square)

// Centre the grid inside the card
const GRID_W = CELL_SIZE * 5;
const GRID_H = CELL_SIZE * 5;
const GRID_OFFSET_X = (CARD_W - GRID_W) / 2;   // horizontal centering
const GRID_OFFSET_Y = TITLE_H + HEADER_H + (CONTENT_H - GRID_H) / 2; // vertical centering

// ── Print-friendly colour palette ─────────────────────────────────────────
const C_WHITE = [255, 255, 255];
const C_PAGE_BG = [245, 245, 248];   // very light grey page
const C_CARD_BG = [255, 255, 255];   // card white background
const C_CELL_ALT = [244, 245, 252];   // subtle checkerboard tint
const C_FREE_BG = [228, 222, 255];   // soft lavender free space
const C_BORDER = [190, 194, 218];   // grid lines
const C_OUTER_BORDER = [55, 75, 175];    // card outer frame (dark blue)
const C_TITLE_BG = [55, 75, 175];    // deep blue title bar
const C_HEADER_BG = [228, 232, 255];   // light blue/lavender BINGO row
const C_HEADER_TXT = [45, 55, 170];    // BINGO letters colour
const C_NUM = [15, 15, 15];    // near-black numbers
const C_WORD = [25, 25, 25];    // dark text for words
const C_FREE_TXT = [85, 55, 200];    // purple FREE label
const C_FOOTER = [155, 155, 165];   // footer text

// ── Helpers ───────────────────────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Cannot load image: ${src}`));
    img.src = src;
  });
}

/** Vertical baseline position centred inside a band. */
function vCentre(top, height, fontSize) {
  return top + height / 2 + fontSize * 0.35;
}

/**
 * Fetch a font file from a URL and return it as a base64 string.
 * Used to embed Anton (Impact-like) into jsPDF.
 */
async function fetchFontBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  const buf   = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary  = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Register the Anton font with jsPDF.
 * Anton is a condensed, heavy display font — very close to Impact.
 * IMPORTANT: jsPDF only supports TTF format, not WOFF/WOFF2.
 * We fetch the TTF directly from Google Fonts via jsDelivr GitHub CDN (CORS-friendly).
 * Falls back silently to helvetica-bold if the CDN is unreachable.
 * Returns the jsPDF font name to use ('Anton' or 'helvetica').
 */
async function registerAntonFont(doc) {
  try {
    // Anton Regular TTF — Google Fonts repo served via jsDelivr (CORS + TTF = works with jsPDF)
    const url   = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/anton/Anton-Regular.ttf';
    const b64   = await fetchFontBase64(url);
    const fname = 'Anton-Regular.ttf';
    doc.addFileToVFS(fname, b64);
    doc.addFont(fname, 'Anton', 'normal');
    return 'Anton';
  } catch (e) {
    console.warn('[BingoGenerator] Anton font unavailable, using helvetica:', e.message);
    return 'helvetica';
  }
}

// ── Single card renderer ──────────────────────────────────────────────────

/**
 * Draw one bingo card at position (ox, oy).
 * @param {object} doc        jsPDF instance
 * @param {Array}  grid       flat 25-item array  (null = free space)
 * @param {string} title      card title string
 * @param {number} cardIndex  1-based card number
 * @param {number} ox         left edge of card (mm)
 * @param {number} oy         top  edge of card (mm)
 * @param {Map}    imageCache preloaded HTMLImageElement map
 */
async function drawCard(doc, grid, title, cardIndex, ox, oy, imageCache, impactFont) {

  // ── White card background ──────────────────────────────────────────────
  doc.setFillColor(...C_CARD_BG);
  doc.rect(ox, oy, CARD_W, CARD_H, 'F');

  // ── Title bar ──────────────────────────────────────────────────────────
  doc.setFillColor(...C_TITLE_BG);
  doc.rect(ox, oy, CARD_W, TITLE_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_WHITE);
  doc.text(title, ox + CARD_W / 2, vCentre(oy, TITLE_H, 8.5), { align: 'center' });

  // Card number badge
  const badge = `N° ${cardIndex}`;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  const bW = doc.getTextWidth(badge) + 4;
  const bH = 4.5;
  const bX = ox + CARD_W - bW - 2;
  const bY = oy + (TITLE_H - bH) / 2;
  doc.setFillColor(255, 255, 255, 35);
  doc.roundedRect(bX, bY, bW, bH, 1.2, 1.2, 'F');
  doc.setTextColor(...C_WHITE);
  doc.text(badge, bX + bW / 2, bY + bH / 2 + 6.5 * 0.35, { align: 'center' });

  // ── BINGO column headers ───────────────────────────────────────────────
  const BINGO = ['B', 'I', 'N', 'G', 'O'];
  const headerY = oy + TITLE_H;
  const gridX = ox + GRID_OFFSET_X;

  doc.setFillColor(...C_HEADER_BG);
  // Fill entire header row width (card width)
  doc.rect(ox, headerY, CARD_W, HEADER_H, 'F');

  for (let c = 0; c < 5; c++) {
    const cx = gridX + c * CELL_SIZE;
    if (c > 0) {
      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.25);
      doc.line(cx, headerY, cx, headerY + HEADER_H);
    }
    // Use Anton (Impact-like) for BINGO letters at a generous size
    doc.setFont(impactFont, impactFont === 'helvetica' ? 'bold' : 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...C_HEADER_TXT);
    doc.text(BINGO[c], cx + CELL_SIZE / 2, vCentre(headerY, HEADER_H, 11), { align: 'center' });
  }

  // ── 5×5 cell grid ─────────────────────────────────────────────────────
  const gridY = oy + GRID_OFFSET_Y;

  for (let i = 0; i < 25; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const cx = gridX + col * CELL_SIZE;
    const cy = gridY + row * CELL_SIZE;
    const cell = grid[i];

    // Cell background
    if (cell === null) {
      doc.setFillColor(...C_FREE_BG);
    } else if ((row + col) % 2 === 1) {
      doc.setFillColor(...C_CELL_ALT);
    } else {
      doc.setFillColor(...C_CARD_BG);
    }
    doc.rect(cx, cy, CELL_SIZE, CELL_SIZE, 'F');

    // Cell border
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.25);
    doc.rect(cx, cy, CELL_SIZE, CELL_SIZE, 'S');

    // Cell content
    if (cell === null) {
      // Free space
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...C_FREE_TXT);
      doc.text('★', cx + CELL_SIZE / 2, cy + CELL_SIZE / 2 + 13 * 0.35, { align: 'center' });
      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C_FREE_TXT);
      doc.text('LIBRE', cx + CELL_SIZE / 2, cy + CELL_SIZE - 2, { align: 'center' });

    } else if (cell.type === 'number') {
      // Anton gives the classic bingo look — large, condensed, bold
      doc.setFont(impactFont, impactFont === 'helvetica' ? 'bold' : 'normal');
      doc.setTextColor(...C_NUM);
      // 1–2 digits: maximum size; 3+ digits: slightly smaller to fit
      const fs = cell.value.length <= 2 ? 19 : 14;
      doc.setFontSize(fs);
      doc.text(cell.value, cx + CELL_SIZE / 2, cy + CELL_SIZE / 2 + fs * 0.35, { align: 'center' });

    } else if (cell.type === 'word') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C_WORD);
      const fs = cell.value.length > 10 ? 4.5 : cell.value.length > 6 ? 5.5 : 7;
      doc.setFontSize(fs);
      const lines = doc.splitTextToSize(cell.value, CELL_SIZE - 2);
      const lineH = fs * 0.45;
      const totalH = lines.length * lineH;
      const startY = cy + (CELL_SIZE - totalH) / 2 + fs * 0.35;
      doc.text(lines.slice(0, 3), cx + CELL_SIZE / 2, startY, {
        align: 'center',
        lineHeightFactor: 1.25,
      });

    } else if (cell.type === 'image') {
      const img = imageCache.get(cell.value);
      if (img) {
        const pad = 1.5;
        const avail = CELL_SIZE - pad * 2;
        const ratio = img.naturalWidth / img.naturalHeight;
        let dw = avail, dh = avail;
        if (ratio > 1) dh = avail / ratio;
        else dw = avail * ratio;
        const dx = cx + (CELL_SIZE - dw) / 2;
        const dy = cy + (CELL_SIZE - dh) / 2;
        try {
          doc.addImage(img, 'PNG', dx, dy, dw, dh);
        } catch {
          doc.setFontSize(4);
          doc.setTextColor(...C_FOOTER);
          doc.text('[img]', cx + CELL_SIZE / 2, cy + CELL_SIZE / 2 + 2, { align: 'center' });
        }
      } else {
        doc.setFontSize(4);
        doc.setTextColor(...C_FOOTER);
        doc.text('[img]', cx + CELL_SIZE / 2, cy + CELL_SIZE / 2 + 2, { align: 'center' });
      }
    }
  }

  // ── Outer card border ─────────────────────────────────────────────────
  doc.setDrawColor(...C_OUTER_BORDER);
  doc.setLineWidth(0.6);
  doc.rect(ox, oy, CARD_W, CARD_H, 'S');
}

// ── Public export ─────────────────────────────────────────────────────────

/**
 * Generate and download the PDF.
 * @param {Array}    cards      array of 25-cell grids
 * @param {string}   title      card title text
 * @param {Function} onProgress callback(0–100)
 */
export async function exportToPDF(cards, title, onProgress) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Load Anton (Impact-like) font — falls back to helvetica-bold if unavailable
  const impactFont = await registerAntonFont(doc);

  // Pre-load all unique images
  const imageUrls = new Set();
  for (const grid of cards) {
    for (const cell of grid) {
      if (cell && cell.type === 'image') imageUrls.add(cell.value);
    }
  }
  const imageCache = new Map();
  for (const url of imageUrls) {
    try {
      const img = await loadImage(url);
      imageCache.set(url, img);
    } catch {
      console.warn('Could not load image for PDF:', url.slice(0, 60));
    }
  }

  const totalCards = cards.length;

  // 4 positions per page: top-left, top-right, bottom-left, bottom-right
  const positions = [
    { ox: MARGIN_X, oy: MARGIN_Y },
    { ox: MARGIN_X + CARD_W + COL_GAP, oy: MARGIN_Y },
    { ox: MARGIN_X, oy: MARGIN_Y + CARD_H + ROW_GAP },
    { ox: MARGIN_X + CARD_W + COL_GAP, oy: MARGIN_Y + CARD_H + ROW_GAP },
  ];

  for (let i = 0; i < totalCards; i++) {
    const posIndex = i % 4;

    // New page every 4 cards
    if (posIndex === 0) {
      if (i > 0) doc.addPage();
      // Light page background
      doc.setFillColor(...C_PAGE_BG);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    }

    const { ox, oy } = positions[posIndex];
    await drawCard(doc, cards[i], title, i + 1, ox, oy, imageCache, impactFont);

    onProgress?.(Math.round(((i + 1) / totalCards) * 100));
  }

  // Page numbers footer
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_FOOTER);
    doc.text(`Página ${p} / ${pageCount}`, PAGE_W - MARGIN_X, PAGE_H - 3.5, { align: 'right' });
    doc.text('Bingo Generator Pro', MARGIN_X, PAGE_H - 3.5);
  }

  doc.save(`bingo-tarjetas-${totalCards}.pdf`);
}
