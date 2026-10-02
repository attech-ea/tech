// Slices a 5x2 grid PNG of handwritten digits (0-4 top row, 5-9 bottom row)
// into 10 individual transparent PNGs, matching the same "luminance becomes
// alpha, ink becomes near-black" treatment already used for
// public/refeicoes-completas.png.
//
// Usage: npx tsx scripts/slice-digits.ts [caminho-para-imagem-grade.png]
// Sem argumento, procura scripts/digits-source.png.
//
// As caixas COLS/ROWS abaixo são coordenadas de pixel específicas do layout
// dessa imagem fonte (medidas via varredura de brilho máximo por
// coluna/linha para achar os espaços vazios entre os dígitos). Se trocar a
// imagem fonte por uma com espaçamento diferente, meça de novo.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = process.argv[2] || path.join(__dirname, 'digits-source.png');
if (!fs.existsSync(SRC)) {
  console.error(`Imagem fonte não encontrada: ${SRC}\nPasse o caminho como argumento: npx tsx scripts/slice-digits.ts <caminho.png>`);
  process.exit(1);
}
const OUT_DIR = path.join(__dirname, '..', 'public', 'digits');

const COLS: [number, number][] = [
  [114, 302], // 0 / 5
  [413, 564], // 1 / 6
  [629, 859], // 2 / 7
  [944, 1118], // 3 / 8
  [1230, 1420], // 4 / 9
];
const PAD_X = 15;
const ROW_HEIGHT = 361;
const ROW_BOTTOM_PAD = 20;
const ROWS: { digits: number[]; bottom: number }[] = [
  { digits: [0, 1, 2, 3, 4], bottom: 442 + ROW_BOTTOM_PAD },
  { digits: [5, 6, 7, 8, 9], bottom: 862 + ROW_BOTTOM_PAD },
];

// The source strokes are a thin, faint pencil-gray line (peak brightness
// only ~132, most of the stroke body sits around 40-70). A plain linear
// stretch keeps that faintness. To match the bold solid-ink look of the
// existing public/refeicoes-completas.png asset, treat brightness as a
// threshold band instead: below LOW -> transparent, above HIGH -> fully
// opaque ink, with a short smooth ramp between for anti-aliased edges.
const ALPHA_LOW = 12;
const ALPHA_HIGH = 40;
function brightnessToAlpha(v: number): number {
  if (v <= ALPHA_LOW) return 0;
  if (v >= ALPHA_HIGH) return 255;
  return Math.round(((v - ALPHA_LOW) / (ALPHA_HIGH - ALPHA_LOW)) * 255);
}

// The traced strokes are already near hard-edged in the source (barely any
// soft gradient to exploit via the threshold above), so making the ink look
// noticeably bolder means actually growing the stroke, not just re-tuning
// alpha. STROKE_GROW_PX is how much to grow on each edge, in the *original*
// crop resolution — sub-pixel amounts matter here since a stroke is only
// ~4-5px wide, so we upsample first (UPSCALE_FOR_GROW) and dilate at that
// higher resolution, then downsample back, which re-introduces smooth
// anti-aliased edges.
const STROKE_GROW_PX = 0.5;
const UPSCALE_FOR_GROW = 4;

// Separable max-filter (dilation) by a square window of the given radius.
// Correct and much cheaper than a naive 2D window: horizontal max pass,
// then vertical max pass over the result.
function dilate(buf: Buffer, width: number, height: number, radius: number): Buffer {
  const h = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      let m = 0;
      const xStart = Math.max(0, x - radius);
      const xEnd = Math.min(width - 1, x + radius);
      for (let xx = xStart; xx <= xEnd; xx++) {
        const v = buf[rowOff + xx];
        if (v > m) m = v;
      }
      h[rowOff + x] = m;
    }
  }
  const out = Buffer.alloc(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let m = 0;
      const yStart = Math.max(0, y - radius);
      const yEnd = Math.min(height - 1, y + radius);
      for (let yy = yStart; yy <= yEnd; yy++) {
        const v = h[yy * width + x];
        if (v > m) m = v;
      }
      out[y * width + x] = m;
    }
  }
  return out;
}

async function growAlphaPlane(alphaBuf: Buffer, width: number, height: number): Promise<Buffer> {
  const upW = Math.round(width * UPSCALE_FOR_GROW);
  const upH = Math.round(height * UPSCALE_FOR_GROW);
  // .toColorspace('b-w') keeps this single-channel after resize — without
  // it sharp silently promotes the raw 1-channel buffer to 3-channel sRGB,
  // which desyncs the buffer length from the width*height we assume below.
  const upBuf = await sharp(alphaBuf, { raw: { width, height, channels: 1 } })
    .resize(upW, upH, { kernel: 'cubic' })
    .toColorspace('b-w')
    .raw()
    .toBuffer();

  const radius = Math.max(1, Math.round(STROKE_GROW_PX * UPSCALE_FOR_GROW));
  const dilated = dilate(upBuf, upW, upH, radius);

  return sharp(dilated, { raw: { width: upW, height: upH, channels: 1 } })
    .resize(width, height, { kernel: 'cubic' })
    .toColorspace('b-w')
    .raw()
    .toBuffer();
}

async function main() {
  const full = sharp(SRC).raw();
  const { data, info } = await full.toBuffer({ resolveWithObject: true });
  const { width, channels } = info;

  for (const row of ROWS) {
    const top = row.bottom - ROW_HEIGHT;
    for (let i = 0; i < row.digits.length; i++) {
      const digit = row.digits[i];
      const [colStart, colEnd] = COLS[i];
      const left = colStart - PAD_X;
      const cropWidth = colEnd - colStart + PAD_X * 2;

      const alphaPlane = Buffer.alloc(cropWidth * ROW_HEIGHT);
      for (let y = 0; y < ROW_HEIGHT; y++) {
        const srcY = top + y;
        for (let x = 0; x < cropWidth; x++) {
          const srcX = left + x;
          const srcIdx = (srcY * width + srcX) * channels;
          const v = Math.max(data[srcIdx], data[srcIdx + 1], data[srcIdx + 2]);
          alphaPlane[y * cropWidth + x] = brightnessToAlpha(v);
        }
      }
      const grownAlpha = await growAlphaPlane(alphaPlane, cropWidth, ROW_HEIGHT);

      const out = Buffer.alloc(cropWidth * ROW_HEIGHT * 4);
      for (let p = 0; p < cropWidth * ROW_HEIGHT; p++) {
        out[p * 4] = 0;
        out[p * 4 + 1] = 0;
        out[p * 4 + 2] = 0;
        out[p * 4 + 3] = grownAlpha[p];
      }

      const outPath = path.join(OUT_DIR, `${digit}.png`);
      await sharp(out, { raw: { width: cropWidth, height: ROW_HEIGHT, channels: 4 } })
        .png()
        .toFile(outPath);
      console.log('wrote', outPath, `${cropWidth}x${ROW_HEIGHT}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
