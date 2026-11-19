'use strict';

/**
 * Minimal PDF writer: text-only pages in Helvetica, with correct xref byte
 * offsets so standard PDF readers (and pdf.js) open the file. Used for the
 * demo resume and test fixtures.
 */
function escapePdf(s) {
  return s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7E]/g, '-');
}

function buildPdfFromLines(lines, { fontSize = 11, leading = 15, margin = 60 } = {}) {
  const pageHeight = 792;
  const perPage = Math.floor((pageHeight - margin * 2) / leading);
  const pages = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) pages.push(lines.slice(i, i + perPage));

  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];
  for (const pageLines of pages) {
    let y = pageHeight - margin;
    const ops = pageLines.map((line) => {
      const bold = line.startsWith('# ');
      const text = escapePdf(bold ? line.slice(2) : line);
      const op = `BT /${bold ? 'F2' : 'F1'} ${bold ? fontSize + 2 : fontSize} Tf ${margin} ${y} Td (${text}) Tj ET`;
      y -= leading;
      return op;
    });
    const stream = ops.join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    pageIds.push(
      add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`)
    );
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/** A structurally valid PDF with one page and no text (simulates a scanned image). */
function buildEmptyTextPdf() {
  return buildPdfFromLines([]);
}

module.exports = { buildPdfFromLines, buildEmptyTextPdf };
