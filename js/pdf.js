/**
 * pdf.js — PDF export logic using jsPDF
 *
 * Renders 2 bingo cards per A4 page (portrait).
 * Each card: 5×5 grid with BINGO column headers, title, and card number.
 */

/* global jspdf */

const PAGE_W = 210;  // A4 width  in mm
const PAGE_H = 297;  // A4 height in mm

const MARGIN_X  = 14;
const MARGIN_Y  = 14;
const CARD_GAP  = 8;    // vertical gap between two cards on same page

const CARD_W    = PAGE_W - MARGIN_X * 2;
const CARD_H    = (PAGE_H - MARGIN_Y * 2 - CARD_GAP) / 2;

// Inside one card
const TITLE_H   = 12;   // title bar height
const HEADER_H  = 8;    // BINGO row height
const CONTENT_H = CARD_H - TITLE_H - HEADER_H;
const CELL_W    = CARD_W / 5;
const CELL_H    = CONTENT_H / 5;

// Colors (RGB)
const COLOR_PURPLE     = [139, 92, 246];
const COLOR_INDIGO     = [99, 102, 241];
const COLOR_CELL_BG    = [30, 32, 48];
const COLOR_CELL_ALT   = [37, 40, 64];
const COLOR_FREE       = [48, 36, 80];
const COLOR_BORDER     = [50, 54, 80];
const COLOR_WHITE      = [255, 255, 255];
const COLOR_TEXT_DARK  = [240, 242, 255];
const COLOR_TEXT_MUTED = [148, 153, 181];
const COLOR_NUM        = [129, 140, 248];

/**
 * Loads an image URL into an HTMLImageElement (needed for jsPDF addImage).
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Cannot load image: ${src}`));
    img.src = src;
  });
}

/**
 * Draw a gradient rect (simulated with jsPDF solid fill since jsPDF doesn't
 * natively support CSS gradients — we use a purple→indigo two-stop approximation).
 */
function drawGradientRect(doc, x, y, w, h) {
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(COLOR_PURPLE[0] + (COLOR_INDIGO[0] - COLOR_PURPLE[0]) * t);
    const g = Math.round(COLOR_PURPLE[1] + (COLOR_INDIGO[1] - COLOR_PURPLE[1]) * t);
    const b = Math.round(COLOR_PURPLE[2] + (COLOR_INDIGO[2] - COLOR_PURPLE[2]) * t);
    doc.setFillColor(r, g, b);
    const colW = w / steps;
    doc.rect(x + i * colW, y, colW + 0.5, h, 'F');
  }
}

/**
 * Draw a single bingo card at the given top-left corner (ox, oy).
 * @param {object}  doc        - jsPDF instance
 * @param {Array}   grid       - flat 25-item array
 * @param {string}  title      - card title
 * @param {number}  cardIndex  - 1-based card number
 * @param {number}  ox         - x offset (mm)
 * @param {number}  oy         - y offset (mm)
 * @param {Map}     imageCache - preloaded images map { dataUrl → HTMLImageElement }
 */
async function drawCard(doc, grid, title, cardIndex, ox, oy, imageCache) {
  /* ---- Title Bar ---- */
  drawGradientRect(doc, ox, oy, CARD_W, TITLE_H);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_WHITE);
  doc.text(title, ox + 4, oy + TITLE_H / 2 + 3);

  // Card # badge (right side)
  const badge = `#${cardIndex}`;
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255, 180);
  const badgeW = doc.getTextWidth(badge) + 5;
  doc.setFillColor(255, 255, 255, 40);
  doc.roundedRect(ox + CARD_W - badgeW - 2, oy + 3, badgeW, TITLE_H - 6, 2, 2, 'F');
  doc.text(badge, ox + CARD_W - badgeW / 2 - 2, oy + TITLE_H / 2 + 2.5, { align: 'center' });

  /* ---- BINGO Column Headers ---- */
  const BINGO = ['B', 'I', 'N', 'G', 'O'];
  const headerY = oy + TITLE_H;

  for (let c = 0; c < 5; c++) {
    const cx = ox + c * CELL_W;
    const shade = c % 2 === 0
      ? [35, 28, 65]
      : [28, 22, 55];
    doc.setFillColor(...shade);
    doc.rect(cx, headerY, CELL_W, HEADER_H, 'F');

    // border
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(cx, headerY, CELL_W, HEADER_H, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_PURPLE);
    doc.text(BINGO[c], cx + CELL_W / 2, headerY + HEADER_H / 2 + 2.5, { align: 'center' });
  }

  /* ---- Cell Grid ---- */
  const gridY = oy + TITLE_H + HEADER_H;

  for (let i = 0; i < 25; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const cx  = ox + col * CELL_W;
    const cy  = gridY + row * CELL_H;
    const cell = grid[i];

    // Background
    if (cell === null) {
      doc.setFillColor(...COLOR_FREE);
    } else {
      doc.setFillColor(...((row + col) % 2 === 0 ? COLOR_CELL_BG : COLOR_CELL_ALT));
    }
    doc.rect(cx, cy, CELL_W, CELL_H, 'F');

    // Border
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.15);
    doc.rect(cx, cy, CELL_W, CELL_H, 'S');

    // Content
    if (cell === null) {
      // Free space — star symbol
      doc.setFontSize(14);
      doc.setTextColor(...COLOR_PURPLE);
      doc.text('★', cx + CELL_W / 2, cy + CELL_H / 2 + 4, { align: 'center' });

      doc.setFontSize(5);
      doc.setTextColor(...COLOR_TEXT_MUTED);
      doc.text('FREE', cx + CELL_W / 2, cy + CELL_H - 2, { align: 'center' });
    } else if (cell.type === 'number') {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_NUM);
      doc.text(cell.value, cx + CELL_W / 2, cy + CELL_H / 2 + 3.5, { align: 'center' });
    } else if (cell.type === 'word') {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_TEXT_DARK);
      // Auto-scale font to fit
      const maxChars = 8;
      const fs = cell.value.length > maxChars ? 5.5 : 6.5;
      doc.setFontSize(fs);
      const lines = doc.splitTextToSize(cell.value, CELL_W - 2);
      const totalH = lines.length * (fs * 0.35);
      const startY = cy + CELL_H / 2 - totalH / 2 + fs * 0.3;
      doc.text(lines.slice(0, 3), cx + CELL_W / 2, startY, { align: 'center', lineHeightFactor: 1.3 });
    } else if (cell.type === 'image') {
      const img = imageCache.get(cell.value);
      if (img) {
        const pad    = 1.5;
        const imgW   = CELL_W - pad * 2;
        const imgH   = CELL_H - pad * 2;
        // Preserve aspect ratio
        const ratio  = img.naturalWidth / img.naturalHeight;
        let dw = imgW;
        let dh = imgH;
        if (ratio > 1) {
          dh = imgW / ratio;
        } else {
          dw = imgH * ratio;
        }
        const dx = cx + (CELL_W - dw) / 2;
        const dy = cy + (CELL_H - dh) / 2;
        try {
          doc.addImage(img, 'PNG', dx, dy, dw, dh);
        } catch {
          // Fallback: show image label
          doc.setFontSize(5);
          doc.setTextColor(...COLOR_TEXT_MUTED);
          doc.text('[img]', cx + CELL_W / 2, cy + CELL_H / 2 + 1.5, { align: 'center' });
        }
      } else {
        doc.setFontSize(5);
        doc.setTextColor(...COLOR_TEXT_MUTED);
        doc.text('[img]', cx + CELL_W / 2, cy + CELL_H / 2 + 1.5, { align: 'center' });
      }
    }
  }

  /* ---- Outer card border ---- */
  doc.setDrawColor(...COLOR_PURPLE);
  doc.setLineWidth(0.5);
  doc.rect(ox, oy, CARD_W, CARD_H, 'S');
}

/**
 * Main export function.
 * @param {Array}    cards             - array of 25-cell grids
 * @param {string}   title             - card title text
 * @param {Function} onProgress        - callback(percent 0–100)
 */
export async function exportToPDF(cards, title, onProgress) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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

  // Dark background for all pages is added per page below
  const totalCards = cards.length;

  for (let i = 0; i < totalCards; i++) {
    const isEven = i % 2 === 0;

    if (!isEven) {
      // Second card on same page — no new page needed
    } else {
      if (i > 0) doc.addPage();
      // Dark page background
      doc.setFillColor(10, 11, 15);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    }

    const oy = isEven
      ? MARGIN_Y
      : MARGIN_Y + CARD_H + CARD_GAP;

    await drawCard(doc, cards[i], title, i + 1, MARGIN_X, oy, imageCache);

    const progress = Math.round(((i + 1) / totalCards) * 100);
    onProgress?.(progress);
  }

  // Add page numbers (bottom right)
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(`Página ${p} / ${pageCount}`, PAGE_W - MARGIN_X, PAGE_H - 6, { align: 'right' });
    doc.text('Bingo Generator Pro', MARGIN_X, PAGE_H - 6);
  }

  doc.save(`bingo-tarjetas-${totalCards}.pdf`);
}
