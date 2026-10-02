// Wraps the rendered JPEG in a single-page Letter PDF using jsPDF, with
// clickable /Link annotations over the flattened image, positioned from the
// same pixel rects used to draw the link text on canvas.

import { jsPDF } from 'jspdf';

export interface PdfLink {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function jpegBlobToPdfBlob(
  jpegBlob: Blob,
  width: number,
  height: number,
  links: PdfLink[] = []
): Promise<Blob> {
  const jpegDataUrl = await blobToDataURL(jpegBlob);

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const scale = Math.min(pageW / width, pageH / height);
  const drawW = width * scale;
  const drawH = height * scale;
  const offsetX = (pageW - drawW) / 2;
  const offsetY = (pageH - drawH) / 2;

  doc.addImage(jpegDataUrl, 'JPEG', offsetX, offsetY, drawW, drawH);

  // jsPDF's coordinate space is top-left, y-down — same as canvas pixel
  // space — so links only need the same scale/offset used for the image.
  links.forEach((link) => {
    doc.link(offsetX + link.x * scale, offsetY + link.y * scale, link.w * scale, link.h * scale, { url: link.href });
  });

  return doc.output('blob');
}
