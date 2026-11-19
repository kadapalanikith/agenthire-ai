'use strict';

/**
 * Build a small, structurally valid single-page PDF containing `text`.
 * Byte offsets in the xref table are computed so real PDF readers open it.
 */
function buildPdf(text = 'Jane Doe - React, JavaScript, CSS - 3 years experience') {
  const escaped = text.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

module.exports = { buildPdf };
