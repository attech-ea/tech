'use client';

import {
  ArrowsOutCardinalIcon,
  CaretDownIcon,
  EyeIcon,
  FileDashedIcon,
  FilePdfIcon,
  ForkKnifeIcon,
  GearSixIcon,
  ShuffleIcon,
  SpinnerIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react/dist/ssr';
import { fs } from '@/lib/calc-clamp';
import SelectBusca, { type OpcaoBusca } from './relatorio/SelectBusca';
import { btnIcone, btnSecundario, Card, Field, inputClass, SectionHead } from './relatorio/ui';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const STORAGE_KEYS = {
  template: 'pm_template',
  font: 'pm_font',
  refeicoesImg: 'pm_refeicoes_img',
  // v2: o garçom passou a ser ancorado pela esquerda, e o layout padrão foi
  // recalibrado. Ajustes salvos antes disso são ignorados.
  fields: 'pm_fields_v2',
  valor: 'pm_valor_refeicao',
};

type FieldId = 'garcom' | 'data' | 'qtd' | 'refeicoesImg' | 'total';
type FieldKind = 'garcom' | 'data' | 'quantidade' | 'image' | 'total';

interface FieldDef {
  id: FieldId;
  kind: FieldKind;
  label: string;
  sizeRange?: [number, number];
  // 'left': `x` marca onde o texto começa, não o centro. Nomes de tamanhos
  // diferentes ficam todos alinhados logo abaixo do rótulo impresso.
  anchor?: 'left';
  // Traço engrossado (ver TEXT_STROKE): letras ganham contorno, dígitos são dilatados.
  bold?: boolean;
}

interface FieldLayout {
  x: number;
  y: number;
  sizeFrac: number;
  rotation: number;
}

type FieldsLayout = Record<FieldId, FieldLayout>;

const FIELD_DEFS: FieldDef[] = [
  { id: 'garcom', kind: 'garcom', label: 'Garçom (restaurante)', anchor: 'left', bold: true },
  { id: 'data', kind: 'data', label: 'Data', bold: true },
  { id: 'qtd', kind: 'quantidade', label: 'Número de refeições' },
  { id: 'refeicoesImg', kind: 'image', label: 'Imagem "Refeições Completas"', sizeRange: [50, 1000] },
  { id: 'total', kind: 'total', label: 'Total (R$)', bold: true },
];

// Calibrado sobre o canhoto em branco; vale para qualquer aparelho que ainda
// não tenha salvo um ajuste próprio.
const DEFAULT_LAYOUT: FieldsLayout = {
  garcom: { x: 0.103, y: 0.158, sizeFrac: 0.055, rotation: -1 },
  data: { x: 0.7565, y: 0.1447, sizeFrac: 0.039, rotation: -1 },
  qtd: { x: 0.221, y: 0.3954, sizeFrac: 0.15, rotation: -4 },
  refeicoesImg: { x: 0.5355, y: 0.4831, sizeFrac: 0.732, rotation: 0 },
  total: { x: 0.695, y: 0.8717, sizeFrac: 0.088, rotation: -2 },
};

const PLACEHOLDERS: Record<'data' | 'qtd' | 'total', string> = { data: '28/07/26', qtd: '3', total: '90,00' };

// Nossos restaurantes: o canhoto em branco não traz nada no campo "Garçom",
// então o nome é escrito à mão no PDF e varia entre estes.
const RESTAURANTES = [
  'Sucão Macaé',
  'Lanche para Todos',
  'Caldo Campos',
  'Café Amanhecer',
  'Pensão da Tia Ângela',
  'Pensão da Ana',
];

const OPCOES_RESTAURANTE: OpcaoBusca[] = RESTAURANTES.map((label, value) => ({ value, label }));

function sortearRestaurante(atual?: string): string {
  const opcoes = RESTAURANTES.filter((r) => r !== atual);
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

const DEFAULT_TEMPLATE_SRC = '/formulario-mesa.png';
const DEFAULT_REFEICOES_IMG_SRC = '/refeicoes-completas.png';

// Traço fino e inclinado, como o "Refeições Completas" e os dígitos.
// Carregada em app/layout.tsx; o mesmo nome está em --font-hand (globals.css).
const HAND_FONT_DEFAULT = 'Dawning of a New Day';
// Mesma tinta preta dos dígitos e do "Refeições Completas" (o preview usa text-[#1f1f1f]).
const INK = '#1f1f1f';
// A fonte só tem um peso: o "negrito" vem de contornar as letras com a mesma
// tinta. Os dígitos são PNG, então são engrossados redesenhando a própria
// imagem deslocada em 8 direções. Ambos são frações do tamanho da fonte, para
// o preview e o canvas saírem iguais.
const TEXT_STROKE = 0.03;
const DIGIT_DILATE = 0.01;
const DILATE_DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

// Traço extra da '/' e da ',' para acompanhar a dilatação dos dígitos.
function punctuationExtra(bold?: boolean): number {
  return bold ? 2 * DIGIT_DILATE : 0;
}

const DIGIT_SRCS =Array.from({ length: 10 }, (_, d) => `/digits/${d}.png`);
// A digit sprite's own pixel height doesn't equal a font's em-size, so we
// scale it relative to fontPx. Tune this if the digits look too big/small
// next to the punctuation drawn with the handwriting font.
const DIGIT_HEIGHT_SCALE = 1.4;

function isDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

// The handwriting webfont draws '/' and ',' bolder than the fine, thin pen
// line of the digit art, which looks inconsistent right next to it (e.g.
// "28/07/26"). Draw these two as a plain thin stroke instead of text so the
// whole field reads as one consistent pen weight.
function isThinPunctuation(ch: string): boolean {
  return ch === '/' || ch === ',';
}

// Digits and thin punctuation are drawn one by one; any other run of text
// ("Sucão Macaé") stays whole, so the cursive letters connect and spaces survive.
function splitSegments(text: string): string[] {
  return text.match(/[0-9/,]|[^0-9/,]+/g) ?? [];
}

// A whole word tilted as much as a single digit looks drunk; keep it subtler.
function jitterScale(segment: string): number {
  return segment.length > 1 ? 0.25 : 1;
}

function drawPunctuationStroke(ctx: CanvasRenderingContext2D, ch: string, w: number, fontPx: number, extra: number) {
  ctx.save();
  ctx.lineWidth = fontPx * (0.05 + extra);
  ctx.lineCap = 'round';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  if (ch === '/') {
    ctx.moveTo(-w * 0.22, fontPx * 0.32);
    ctx.lineTo(w * 0.22, -fontPx * 0.32);
  } else {
    ctx.moveTo(-w * 0.05, fontPx * 0.05);
    ctx.quadraticCurveTo(w * 0.2, fontPx * 0.2, 0, fontPx * 0.42);
  }
  ctx.stroke();
  ctx.restore();
}

function formatDateParts(isoDate: string): { display: string; file: string } {
  const [y, m, d] = isoDate.split('-');
  const yy = y.slice(2);
  return { display: `${d}/${m}/${yy}`, file: `${d}-${m}-${yy}` };
}

function formatMoney(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sanitizeName(n: string): string {
  return n.trim().toUpperCase().replace(/[\\/:*?"<>|]/g, '');
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

async function ensureFontsReady(): Promise<void> {
  try { await document.fonts.load(`48px ${HAND_FONT_DEFAULT}`); } catch { /* Google Fonts pode ainda não ter carregado */ }
  try { await document.fonts.ready; } catch { /* ambiente sem suporte total à Font Loading API */ }
}

function drawMixedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontPx: number,
  digitImgs: HTMLImageElement[],
  anchor?: FieldDef['anchor'],
  bold?: boolean,
) {
  const stroke = bold ? TEXT_STROKE : 0;
  const dilate = bold ? fontPx * DIGIT_DILATE : 0;
  const chars = splitSegments(text);
  const digitHeight = fontPx * DIGIT_HEIGHT_SCALE;
  const widths = chars.map((c) => {
    const img = isDigitChar(c) ? digitImgs[Number(c)] : null;
    if (img && img.naturalWidth) return digitHeight * (img.naturalWidth / img.naturalHeight);
    return ctx.measureText(c).width;
  });
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  let cursor = anchor === 'left' ? 0 : -totalWidth / 2;
  chars.forEach((c, i) => {
    const w = widths[i];
    const jy = (Math.random() - 0.5) * fontPx * 0.05;
    const jr = (Math.random() - 0.5) * 0.08 * jitterScale(c);
    const img = isDigitChar(c) ? digitImgs[Number(c)] : null;

    if (img && img.naturalWidth) {
      ctx.save();
      ctx.translate(cursor + w / 2, jy);
      ctx.rotate(jr);
      if (dilate) {
        DILATE_DIRS.forEach(([dx, dy]) => {
          ctx.drawImage(img, -w / 2 + dx * dilate, -digitHeight / 2 + dy * dilate, w, digitHeight);
        });
      }
      ctx.drawImage(img, -w / 2, -digitHeight / 2, w, digitHeight);
      ctx.restore();
    } else if (isThinPunctuation(c)) {
      ctx.save();
      ctx.translate(cursor + w / 2, jy);
      ctx.rotate(jr);
      drawPunctuationStroke(ctx, c, w, fontPx, punctuationExtra(bold));
      ctx.restore();
    } else {
      const jx = (Math.random() - 0.5) * fontPx * 0.02;
      ctx.save();
      ctx.translate(cursor + w / 2 + jx, jy);
      ctx.rotate(jr);
      ctx.fillText(c, 0, 0);
      if (stroke) {
        ctx.lineWidth = fontPx * stroke;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = ctx.fillStyle;
        ctx.strokeText(c, 0, 0);
      }
      ctx.restore();
    }
    cursor += w;
  });
}

function PunctuationStroke({ ch, fontSizePx, extra }: { ch: string; fontSizePx: number; extra: number }) {
  const w = ch === '/' ? fontSizePx * 0.5 : fontSizePx * 0.3;
  const h = fontSizePx;
  const cx = w / 2;
  const cy = h / 2;
  const d = ch === '/'
    ? `M ${cx - w * 0.22} ${cy + h * 0.32} L ${cx + w * 0.22} ${cy - h * 0.32}`
    : `M ${cx - w * 0.05} ${cy + h * 0.05} Q ${cx + w * 0.2} ${cy + h * 0.2} ${cx} ${cy + h * 0.42}`;
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={d} stroke={INK} strokeWidth={fontSizePx * (0.05 + extra)} strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Deterministic pseudo-random in [0, 1) so the SSR HTML matches the client
// render (Math.random would cause a hydration mismatch).
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function MixedFieldPreview({ text, fontSizePx, bold }: { text: string; fontSizePx: number; bold?: boolean }) {
  const stroke = bold ? TEXT_STROKE : 0;
  const dilate = bold ? fontSizePx * DIGIT_DILATE : 0;
  const chars = useMemo(
    () => splitSegments(text).map((ch, i) => ({
      ch,
      rot: (hashUnit(`r${i}${ch}`) - 0.5) * 8 * jitterScale(ch),
      ty: (hashUnit(`t${i}${ch}`) - 0.5) * 5,
    })),
    [text],
  );
  const digitHeight = fontSizePx * DIGIT_HEIGHT_SCALE;
  return chars.map((c, i) => {
    const style = { display: 'inline-block', transform: `rotate(${c.rot}deg) translateY(${c.ty}%)` };
    if (isDigitChar(c.ch)) {
      const src = DIGIT_SRCS[Number(c.ch)];
      return (
        <span key={i} style={{ ...style, position: 'relative', verticalAlign: 'middle' }}>
          <img src={src} alt={c.ch} draggable={false} style={{ display: 'block', height: `${digitHeight}px`, width: 'auto' }} />
          {dilate > 0 &&
            DILATE_DIRS.map(([dx, dy], k) => (
              <img
                key={k}
                src={src}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${dx * dilate}px`,
                  top: `${dy * dilate}px`,
                  height: `${digitHeight}px`,
                  width: 'auto',
                }}
              />
            ))}
        </span>
      );
    }
    if (isThinPunctuation(c.ch)) {
      return (
        <span key={i} style={style}>
          <PunctuationStroke ch={c.ch} fontSizePx={fontSizePx} extra={punctuationExtra(bold)} />
        </span>
      );
    }
    return (
      <span key={i} style={{ ...style, whiteSpace: 'pre', WebkitTextStroke: stroke ? `${fontSizePx * stroke}px ${INK}` : undefined }}>
        {c.ch}
      </span>
    );
  });
}

// Wraps the rendered JPEG in a minimal single-page PDF (image embedded via
// DCTDecode, so the JPEG bytes are reused as-is with no re-encoding) sized
// to fit an A4 page, so no PDF library dependency is needed.
async function jpegBlobToPdfBlob(jpegBlob: Blob, width: number, height: number): Promise<Blob> {
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const enc = new TextEncoder();

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const scale = Math.min(PAGE_W / width, PAGE_H / height);
  const drawW = width * scale;
  const drawH = height * scale;
  const offsetX = (PAGE_W - drawW) / 2;
  const offsetY = (PAGE_H - drawH) / 2;

  const contentStream = enc.encode(
    `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm /Im0 Do Q`
  );

  const chunks: BlobPart[] = [];
  const objOffsets: number[] = [];
  let offset = 0;
  function add(bytes: Uint8Array<ArrayBuffer>) {
    chunks.push(bytes);
    offset += bytes.length;
  }

  add(enc.encode('%PDF-1.4\n'));

  objOffsets[1] = offset;
  add(enc.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));

  objOffsets[2] = offset;
  add(enc.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));

  objOffsets[3] = offset;
  add(enc.encode(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  ));

  objOffsets[4] = offset;
  add(enc.encode(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  ));
  add(jpegBytes);
  add(enc.encode('\nendstream\nendobj\n'));

  objOffsets[5] = offset;
  add(enc.encode(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n`));
  add(contentStream);
  add(enc.encode('\nendstream\nendobj\n'));

  const xrefOffset = offset;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(objOffsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  add(enc.encode(xref));

  add(enc.encode(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

  return new Blob(chunks, { type: 'application/pdf' });
}

export default function PedidoMesaApp() {
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE_SRC);
  const [refeicoesImgSrc, setRefeicoesImgSrc] = useState<string>(DEFAULT_REFEICOES_IMG_SRC);
  const [fontStatus, setFontStatus] = useState(`Usando fonte padrão (${HAND_FONT_DEFAULT})`);
  const [valorRefeicao, setValorRefeicao] = useState(30);
  const [calibrating, setCalibrating] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [fields, setFields] = useState<FieldsLayout>(DEFAULT_LAYOUT);
  const [nome, setNome] = useState('');
  const [restaurante, setRestaurante] = useState(RESTAURANTES[0]);
  const [data, setData] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);

  const stageWrapRef = useRef<HTMLDivElement>(null);
  const templateImgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refeicoesImgObjRef = useRef<HTMLImageElement | null>(null);
  const digitImgsRef = useRef<HTMLImageElement[]>([]);
  const fontReadyRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    fontReadyRef.current = ensureFontsReady();
    // Sorteado só no cliente: no SSR fica o primeiro, para não dar mismatch de hidratação.
    setRestaurante(sortearRestaurante());

    const savedTemplate = localStorage.getItem(STORAGE_KEYS.template);
    if (savedTemplate) setTemplate(savedTemplate);

    const savedFields = localStorage.getItem(STORAGE_KEYS.fields);
    if (savedFields) {
      try { setFields({ ...DEFAULT_LAYOUT, ...JSON.parse(savedFields) }); } catch { /* ignora config corrompida */ }
    }

    const savedValor = parseFloat(localStorage.getItem(STORAGE_KEYS.valor) ?? '');
    if (!Number.isNaN(savedValor)) setValorRefeicao(savedValor);

    const savedFont = localStorage.getItem(STORAGE_KEYS.font);
    if (savedFont) loadCustomFont(savedFont);

    const savedImg = localStorage.getItem(STORAGE_KEYS.refeicoesImg);
    const initialImgSrc = savedImg || DEFAULT_REFEICOES_IMG_SRC;
    if (savedImg) setRefeicoesImgSrc(savedImg);
    const img = new Image();
    img.src = initialImgSrc;
    refeicoesImgObjRef.current = img;

    digitImgsRef.current = DIGIT_SRCS.map((src) => {
      const digitImg = new Image();
      digitImg.src = src;
      return digitImg;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = stageWrapRef.current;
    if (!node) return undefined;
    const ro = new ResizeObserver((entries) => setStageWidth(entries[0].contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  function loadCustomFont(dataUrl: string) {
    fontReadyRef.current = (async () => {
      try {
        const face = new FontFace('HandFont', `url(${dataUrl})`);
        await face.load();
        document.fonts.add(face);
        setFontStatus('Usando a fonte personalizada enviada.');
      } catch (err) {
        console.error(err);
        setFontStatus('Não consegui ler essa fonte (.ttf/.otf) — usando a cursiva padrão.');
      }
    })();
  }

  function handleTemplateUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      localStorage.setItem(STORAGE_KEYS.template, result);
      setTemplate(result);
    };
    reader.readAsDataURL(file);
  }

  function handleRefeicoesImgUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      localStorage.setItem(STORAGE_KEYS.refeicoesImg, result);
      setRefeicoesImgSrc(result);
      const img = new Image();
      img.src = result;
      refeicoesImgObjRef.current = img;
    };
    reader.readAsDataURL(file);
  }

  function handleFontUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      localStorage.setItem(STORAGE_KEYS.font, result);
      setFontStatus('Carregando fonte...');
      loadCustomFont(result);
    };
    reader.readAsDataURL(file);
  }

  function handleValorChange(e: ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value) || 0;
    setValorRefeicao(v);
    localStorage.setItem(STORAGE_KEYS.valor, String(v));
  }

  function updateFieldNumber(fieldId: FieldId, key: keyof FieldLayout, value: number) {
    setFields((prev) => {
      const next = { ...prev, [fieldId]: { ...prev[fieldId], [key]: value } };
      localStorage.setItem(STORAGE_KEYS.fields, JSON.stringify(next));
      return next;
    });
  }

  function makeDragHandler(fieldId: FieldId) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      if (!calibrating) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const rect = stageWrapRef.current!.getBoundingClientRect();

      const onMove = (ev: PointerEvent) => {
        const x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
        updateFieldNumber(fieldId, 'x', x);
        updateFieldNumber(fieldId, 'y', y);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
  }

  const qtdNum = quantidade !== '' ? parseFloat(quantidade) || 0 : 0;
  const dateParts = data ? formatDateParts(data) : null;
  const filename = nome.trim() && dateParts ? `${sanitizeName(nome)} - ALIMENTACAO - ${dateParts.file}.pdf` : '';
  const ready = !!template && !!nome.trim() && !!data && quantidade !== '';

  function fieldText(id: FieldId): string {
    const def = FIELD_DEFS.find((f) => f.id === id)!;
    if (def.kind === 'garcom') return restaurante;
    if (def.kind === 'data') return dateParts ? dateParts.display : PLACEHOLDERS.data;
    if (def.kind === 'quantidade') return quantidade !== '' ? String(quantidade) : PLACEHOLDERS.qtd;
    if (def.kind === 'total') return quantidade !== '' ? formatMoney(qtdNum * valorRefeicao) : PLACEHOLDERS.total;
    return '';
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await fontReadyRef.current;
      const imgObj = refeicoesImgObjRef.current;
      if (imgObj) { try { await imgObj.decode(); } catch { /* segue sem a imagem se ela falhar */ } }
      const digitImgs = digitImgsRef.current;
      await Promise.all(digitImgs.map((d) => d.decode().catch(() => { /* dígito cai para a fonte se falhar */ })));

      const templateEl = templateImgRef.current!;
      const canvas = canvasRef.current!;
      canvas.width = templateEl.naturalWidth;
      canvas.height = templateEl.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(templateEl, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      FIELD_DEFS.forEach((def) => {
        const layout = fields[def.id];

        if (def.kind === 'image') {
          if (!imgObj || !imgObj.naturalWidth) return;
          const w = layout.sizeFrac * canvas.width;
          const h = w * (imgObj.naturalHeight / imgObj.naturalWidth);
          ctx.save();
          ctx.translate(layout.x * canvas.width, layout.y * canvas.height);
          ctx.rotate((layout.rotation * Math.PI) / 180);
          ctx.drawImage(imgObj, -w / 2, -h / 2, w, h);
          ctx.restore();
          return;
        }

        const text = fieldText(def.id);
        if (!text) return;
        const fontPx = layout.sizeFrac * canvas.width;
        ctx.save();
        ctx.translate(layout.x * canvas.width, layout.y * canvas.height);
        ctx.rotate((layout.rotation * Math.PI) / 180);
        ctx.font = `${fontPx}px HandFont, "${HAND_FONT_DEFAULT}", cursive`;
        drawMixedText(ctx, text, fontPx, digitImgs, def.anchor, def.bold);
        ctx.restore();
      });

      const jpegBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.95),
      );
      const blob = await jpegBlobToPdfBlob(jpegBlob, canvas.width, canvas.height);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        {/* Sem o overflow-hidden do Card: a lista do combobox do garçom passa da borda do card. */}
        <Card className="relative z-10 overflow-visible!">
          <SectionHead
            icon={<ForkKnifeIcon size={14} />}
            title="Pedido"
            description="Embarcação, dia e quantidade de refeições"
          />
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
            <Field label="Nome da embarcação" htmlFor="nomeEmbarcacao">
              <input
                type="text"
                id="nomeEmbarcacao"
                placeholder="Ex: WAVE"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Garçom (restaurante)" htmlFor="restaurante">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <SelectBusca
                    id="restaurante"
                    opcoes={OPCOES_RESTAURANTE}
                    value={RESTAURANTES.indexOf(restaurante)}
                    onChange={(i) => setRestaurante(RESTAURANTES[i])}
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Sortear outro restaurante"
                  title="Sortear outro"
                  className={`${btnIcone} shrink-0 self-center`}
                  onClick={() => setRestaurante((atual) => sortearRestaurante(atual))}
                >
                  <ShuffleIcon size={14} />
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" htmlFor="dataInput">
                <input
                  type="date"
                  id="dataInput"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Refeições" htmlFor="quantidade">
                <input
                  type="number"
                  id="quantidade"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="Ex: 3"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
            </div>
          </div>
        </Card>

        <section className="flex flex-col gap-3 rounded-2xl bg-attech px-4 py-4 text-white shadow-xl shadow-attech/20 sm:px-5">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span style={fs(11, 12)} className="text-white/60">
                Total
              </span>
              <strong style={fs(22, 28)} className="leading-tight font-semibold tracking-tight text-primary tabular-nums">
                R$ {formatMoney(qtdNum * valorRefeicao)}
              </strong>
            </div>
            <span style={fs(11, 12)} className="pb-1 text-white/60 tabular-nums">
              {qtdNum} × R$ {formatMoney(valorRefeicao)}
            </span>
          </div>
          <button
            type="button"
            disabled={!ready || downloading}
            onClick={handleDownload}
            style={fs(12, 13)}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 font-semibold text-attech transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-attech focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? <SpinnerIcon size={15} className="animate-spin" /> : <FilePdfIcon size={15} weight="bold" />}
            {downloading ? 'Gerando…' : 'Baixar PDF preenchido'}
          </button>
          <p style={fs(11, 12)} className={`text-center text-white/60 ${filename ? 'break-all' : ''}`}>
            {filename || 'Preencha embarcação, data e refeições para liberar o download'}
          </p>
        </section>

        <Card>
          <SectionHead
            icon={<GearSixIcon size={14} />}
            title="Configuração"
            description="Feita uma vez, fica salva neste aparelho"
            action={
              <button
                type="button"
                aria-label={setupOpen ? 'Recolher configuração' : 'Abrir configuração'}
                aria-expanded={setupOpen}
                title={setupOpen ? 'Recolher' : 'Abrir'}
                className={btnIcone}
                onClick={() => setSetupOpen((v) => !v)}
              >
                <CaretDownIcon size={14} className={`transition-transform duration-150 ${setupOpen ? 'rotate-180' : ''}`} />
              </button>
            }
          />
          {setupOpen && (
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
              <Field label="Template do formulário" hint="Já vem carregado (canhoto em branco). Envie só se quiser trocar.">
                <ArquivoInput accept="image/*" rotulo="Trocar template" onChange={handleTemplateUpload} />
              </Field>
              <Field label={'Imagem "Refeições Completas"'} hint="PNG com fundo transparente. Já vem carregada por padrão.">
                <ArquivoInput accept="image/png,image/*" rotulo="Trocar imagem" onChange={handleRefeicoesImgUpload} />
              </Field>
              <Field label="Fonte da letra" hint={fontStatus}>
                <ArquivoInput accept=".ttf,.otf,font/ttf,font/otf" rotulo="Enviar fonte (.ttf/.otf)" onChange={handleFontUpload} />
              </Field>
              <Field label="Valor de cada refeição (R$)" htmlFor="valorRefeicao">
                <input
                  type="number"
                  id="valorRefeicao"
                  value={valorRefeicao}
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  onChange={handleValorChange}
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionHead
          icon={<EyeIcon size={14} />}
          title="Pré-visualização"
          description={calibrating ? 'Arraste cada campo até a linha certa do papel' : 'Como o formulário vai sair no PDF'}
          action={
            <label
              style={fs(12, 13)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-attech/30 ${
                calibrating
                  ? 'border-attech bg-attech text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={calibrating}
                onChange={(e) => setCalibrating(e.target.checked)}
              />
              <ArrowsOutCardinalIcon size={14} weight={calibrating ? 'fill' : 'regular'} />
              Modo de ajuste
            </label>
          }
        />

        {calibrating && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-4 sm:px-5">
            {FIELD_DEFS.map((def) => {
              const layout = fields[def.id];
              const [sizeMin, sizeMax] = def.sizeRange || [10, 150];
              return (
                <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3" key={def.id}>
                  <h3 style={fs(12, 13)} className="font-semibold text-neutral-800">
                    {def.label}
                  </h3>
                  <Ajuste
                    rotulo={def.kind === 'image' ? 'Largura' : 'Tamanho'}
                    min={sizeMin}
                    max={sizeMax}
                    valor={Math.round(layout.sizeFrac * 1000)}
                    onChange={(v) => updateFieldNumber(def.id, 'sizeFrac', v / 1000)}
                  />
                  <Ajuste
                    rotulo="Rotação"
                    min={-20}
                    max={20}
                    valor={layout.rotation}
                    onChange={(v) => updateFieldNumber(def.id, 'rotation', v)}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-center bg-neutral-100/60 p-4 sm:p-6">
          <div
            ref={stageWrapRef}
            className={`relative w-full max-w-155 leading-0 shadow-md ring-1 ring-neutral-200 ${template ? '' : 'hidden'}`}
          >
            <img
              ref={templateImgRef}
              src={template || undefined}
              alt="Template"
              className="block h-auto w-full select-none [-webkit-user-drag:none]"
            />
            <div className="absolute inset-0">
              {FIELD_DEFS.map((def) => {
                const layout = fields[def.id];
                // Ancorado à esquerda, desconta o px-1.5 para o texto (e não a caixa)
                // começar em `x` e girar em torno desse ponto, como no canvas.
                const style = def.anchor === 'left'
                  ? {
                      left: `${layout.x * 100}%`,
                      top: `${layout.y * 100}%`,
                      transform: `translate(-0.375rem, -50%) rotate(${layout.rotation}deg)`,
                      transformOrigin: '0.375rem 50%',
                    }
                  : {
                      left: `${layout.x * 100}%`,
                      top: `${layout.y * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
                    };
                const className = `absolute touch-none select-none whitespace-nowrap px-1.5 py-0.5 font-hand text-[#1f1f1f] ${
                  calibrating
                    ? 'cursor-grab rounded bg-attech/8 outline-1 outline-attech outline-dashed active:cursor-grabbing'
                    : ''
                }`;

                if (def.kind === 'image') {
                  if (!refeicoesImgSrc) return null;
                  return (
                    <img
                      key={def.id}
                      src={refeicoesImgSrc}
                      alt={def.label}
                      draggable={false}
                      className={`${className} p-0`}
                      style={{ ...style, width: `${layout.sizeFrac * stageWidth}px`, height: 'auto' }}
                      onPointerDown={makeDragHandler(def.id)}
                    />
                  );
                }

                const fontSizePx = layout.sizeFrac * stageWidth;
                return (
                  <div
                    key={def.id}
                    className={`${className} inline-flex items-center`}
                    style={{ ...style, fontSize: `${fontSizePx}px` }}
                    onPointerDown={makeDragHandler(def.id)}
                  >
                    <MixedFieldPreview text={fieldText(def.id)} fontSizePx={fontSizePx} bold={def.bold} />
                  </div>
                );
              })}
            </div>
          </div>
          {!template && (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <FileDashedIcon size={48} className="text-neutral-200" />
              <p style={fs(12, 14)} className="max-w-xs text-neutral-500">
                Nenhum template carregado. Abra a Configuração e envie a foto do formulário em branco.
              </p>
            </div>
          )}
        </div>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// Input de arquivo com cara de botão secundário (o nativo não segue o design system).
function ArquivoInput({
  accept,
  rotulo,
  onChange,
}: {
  accept: string;
  rotulo: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [nomeArquivo, setNomeArquivo] = useState('');
  return (
    <label style={fs(12, 13)} className={`${btnSecundario} w-full justify-start has-focus-visible:ring-2 has-focus-visible:ring-neutral-200`}>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          setNomeArquivo(e.target.files?.[0]?.name ?? '');
          onChange(e);
        }}
      />
      <UploadSimpleIcon size={14} className="shrink-0" />
      <span className="truncate">{nomeArquivo || rotulo}</span>
    </label>
  );
}

function Ajuste({
  rotulo,
  min,
  max,
  valor,
  onChange,
}: {
  rotulo: string;
  min: number;
  max: number;
  valor: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={fs(11, 12)} className="flex items-center gap-2 text-neutral-500">
      <span className="w-14 shrink-0">{rotulo}</span>
      <input
        type="range"
        className="min-w-0 flex-1 cursor-pointer accent-attech"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-8 text-right text-neutral-400 tabular-nums">{valor}</span>
    </label>
  );
}
