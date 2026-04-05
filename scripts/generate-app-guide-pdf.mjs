import fs from 'node:fs';
import path from 'node:path';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const OUTPUT_PATH = path.resolve('static/files/daves-sushi-app-guide.pdf');

function escapePdfText(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function approxCharWidth(fontSize, bold = false) {
  return fontSize * (bold ? 0.56 : 0.52);
}

function wrapText(text, fontSize, bold = false, maxWidth = CONTENT_WIDTH) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const maxChars = Math.max(12, Math.floor(maxWidth / approxCharWidth(fontSize, bold)));

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function pdfText(x, y, text, { size = 11, bold = false, color = '0 0 0' } = {}) {
  const font = bold ? 'F2' : 'F1';
  return `BT\n/${font} ${size} Tf\n${color} rg\n1 0 0 1 ${x} ${y} Tm\n(${escapePdfText(text)}) Tj\nET`;
}

function pdfLine(x1, y1, x2, y2, color = '0.82 0.75 0.72', width = 1) {
  return `${width} w\n${color} RG\n${x1} ${y1} m\n${x2} ${y2} l\nS`;
}

function buildPages() {
  const pages = [];
  let ops = [];
  let y = PAGE_HEIGHT - MARGIN;
  let pageNo = 1;

  const ensureSpace = (needed = 48) => {
    if (y - needed < MARGIN) {
      finishPage();
    }
  };

  const finishPage = () => {
    ops.push(pdfLine(MARGIN, 32, PAGE_WIDTH - MARGIN, 32));
    ops.push(pdfText(MARGIN, 18, `Dave's Sushi App Guide - Page ${pageNo}`, { size: 9, color: '0.38 0.33 0.31' }));
    pages.push(ops.join('\n'));
    ops = [];
    y = PAGE_HEIGHT - MARGIN;
    pageNo += 1;
  };

  const title = (text, size = 28) => {
    ensureSpace(56);
    ops.push(pdfText(MARGIN, y, text, { size, bold: true, color: '0.76 0.13 0.17' }));
    y -= size + 10;
  };

  const heading = (text) => {
    ensureSpace(38);
    ops.push(pdfText(MARGIN, y, text, { size: 18, bold: true }));
    y -= 18 + 10;
  };

  const subheading = (text) => {
    ensureSpace(24);
    ops.push(pdfText(MARGIN, y, text, { size: 12, bold: true, color: '0.76 0.13 0.17' }));
    y -= 18;
  };

  const paragraph = (text, opts = {}) => {
    const size = opts.size ?? 11;
    const bold = opts.bold ?? false;
    const color = opts.color ?? '0.13 0.10 0.09';
    const gap = opts.gap ?? 6;
    const lines = wrapText(text, size, bold);
    ensureSpace(lines.length * (size + 3) + 6);
    for (const line of lines) {
      ops.push(pdfText(MARGIN, y, line, { size, bold, color }));
      y -= size + 3;
    }
    y -= gap;
  };

  const bullet = (label, text) => {
    const bulletX = MARGIN + 10;
    const textX = MARGIN + 28;
    const size = 10.8;
    const lines = wrapText(text, size, false, CONTENT_WIDTH - 28);
    ensureSpace((lines.length + 1) * 15 + 4);
    ops.push(pdfText(bulletX, y, '-', { size: 12, bold: true, color: '0.76 0.13 0.17' }));
    ops.push(pdfText(textX, y, label, { size: 11, bold: true }));
    y -= 15;
    for (const line of lines) {
      ops.push(pdfText(textX, y, line, { size }));
      y -= 14;
    }
    y -= 3;
  };

  title("Dave's Sushi App Map");
  paragraph(
    'This guide is a technical walk-through of the live app. It explains what each major area does, how staff should use it, and how the operational pieces connect day to day.',
    { color: '0.38 0.33 0.31' }
  );

  heading('High-Level Layout');
  bullet('Home', 'Primary launch point into lists, documents, menu, temperatures, recipes, and admin tools.');
  bullet('Lists', 'Operational core containing checklists, prep lists, orders, and inventory flows.');
  bullet('Documents', 'Reference area for the handbook, SOP material, and app information.');
  bullet('Menu', 'In-app viewer for the main menu and secret menu with mobile-friendly zoom.');
  bullet('Temper', 'Live sensor page showing the latest node readings and warning states.');
  bullet('Whiteboard / Notes', 'Shared communication surfaces for ideas, updates, and meeting-style notes.');

  heading('Operational Pages');
  bullet('Check Lists', 'Shift-based completion lists for kitchen, sushi, and prep workflows.');
  bullet('Prep Lists', 'Flexible text entry lists for exact working notes such as cut 1, 1/3 pan, or ask kitchen.');
  bullet('Orders', 'Supplier-facing ordering references with predictable quantity-style entry.');
  bullet('Inventory', 'Area-based stock lists for more structured count tracking.');
  bullet('Recipes', 'Recipe reference area for repeatable kitchen standards.');
  bullet('Specials', 'Special-item and service-facing content without altering the main menu.');

  finishPage();

  heading('Documents And Visual References');
  bullet('Handbook / SOP', 'Long-form operational references rendered directly in the app with zoom support.');
  bullet('Menus', 'Main and secret menu sheets available in-app without leaving the system.');
  bullet('About', 'General app overview and guide material intended for orientation and reference.');

  heading('Temperature Monitoring Flow');
  bullet('1. Sensor Nodes', 'ESP8266-based nodes collect DHT22 readings and forward them to the gateway over ESP-NOW.');
  bullet('2. Gateway', 'The gateway receives node packets, batches recent readings, and posts them to the ingest route.');
  bullet('3. Temper Page', 'The app converts readings into live tiles with warning and stale handling for quick checks.');

  heading('Admin Controls');
  bullet('Admin / Users', 'Invite and access management for the team.');
  bullet('Admin / Lists', 'Maintenance for list structure, par values, references, and item content.');
  bullet('Admin / Documents', 'Document metadata and file references for About, SOP, and Handbook content.');
  bullet('Admin / Recipes', 'Recipe maintenance for structured recipe content.');
  bullet('Admin / Camera', 'Camera-source and capture administration.');
  bullet('Admin Dashboard', 'Moderation and oversight actions for operational review.');

  finishPage();

  heading('How Staff Should Move Through The App');
  bullet('Start On Home', 'Use Home as the jump board instead of browsing around. It exists to reduce hunting.');
  bullet('Open The Correct List', 'Choose the correct checklist, prep list, order sheet, or inventory sheet for the task being performed.');
  bullet('Use Documents As Reference', 'Menus, SOPs, the handbook, and this guide are meant for quick lookup rather than active data entry.');
  bullet('Use Notes For Communication', 'When information does not belong inside a list item, place it in the communication surfaces instead of burying it.');

  heading('What The App Is Best At');
  paragraph('The system is strongest when it is used as a single operating surface for repeatable daily work: prep tracking, list completion, reference access, temperature visibility, and team coordination.');
  paragraph('This guide intentionally omits internal security and infrastructure details. It is meant to explain function and workflow, not sensitive implementation internals.', {
    color: '0.38 0.33 0.31'
  });

  finishPage();
  return pages;
}

function buildPdf(pages) {
  const objects = [];

  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesPlaceholderId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageIds = [];
  const contentIds = [];

  for (const content of pages) {
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesPlaceholderId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    contentIds.push(contentId);
    pageIds.push(pageId);
  }

  objects[pagesPlaceholderId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

const pages = buildPages();
const pdf = buildPdf(pages);
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, pdf, 'binary');
console.log(`Wrote ${OUTPUT_PATH}`);
