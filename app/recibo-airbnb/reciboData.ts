export interface ReciboInput {
  cidade: string;
  viajante: string;
  checkinISO: string;
  noites: number;
  hospedes: number;
  valorTotal: number;
}

export interface ReciboRandom {
  idCode: string;
  confirmCode: string;
  anfitriao: string;
  horaPagamento: string;
}

export type ReciboData = ReciboInput & ReciboRandom;

export const SERVICE_FEE_RATE = 0.1;
export const TAX_RATE = 0.05;

const PRIMEIRO_NOMES = [
  'Gabriela', 'Rafael', 'Beatriz', 'Lucas', 'Camila', 'Felipe', 'Juliana', 'Bruno', 'Larissa', 'Thiago',
  'Fernanda', 'Rodrigo', 'Amanda', 'Diego', 'Patrícia', 'Gustavo', 'Carolina', 'Eduardo', 'Renata', 'Marcelo',
];

const SOBRENOMES = [
  'Mendes', 'Silva', 'Souza', 'Oliveira', 'Costa', 'Pereira', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes',
  'Martins', 'Araújo', 'Barbosa', 'Rocha', 'Dias', 'Nunes', 'Teixeira', 'Correia', 'Cardoso', 'Freitas',
];

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomAlnum(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALNUM[Math.floor(Math.random() * ALNUM.length)];
  return out;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const QUARTO_FILES = [
  '01834631-b37e-47ca-8b3e-cac9a66889a1.avif',
  '0bf3064a-072d-4a93-8347-80393ee0b5e2.avif',
  '11237df0-c359-4cf8-bdde-3e5b2cd3de13.avif',
  '11dff1fc-ce91-4285-98a7-ea50a6e0840a.avif',
  '2441cfd7-375b-4e00-9e2d-bb92ac3a76d3.avif',
  '268ff61d-e0f5-4293-b6e7-29f00ff3d8c5.avif',
  '2b97bc9a-51f9-47c9-ad06-019771f3001c.avif',
  '42ed70cc-81bb-4c3e-a8f4-34b963ffa9f8.avif',
  '56fd3dec-123c-4b07-9dac-80594b96fcdd.avif',
  '691431cd-2401-4f42-8093-a518b505a24f.avif',
  '6d78fbd6-6f33-469e-942e-cbf366a08266.avif',
  '7f703b49-f0a9-46f0-812c-c9a207ad11de.avif',
  '8777b425-7d1f-4c0d-8cd2-2e0e96ff96ea.avif',
  '87b876d8-143d-474e-a629-b5e5a4cc6887.avif',
  'affe63db-97f8-47c0-8349-cb2945bfa4ed.avif',
  'ce01fe38-1dab-4f27-813b-6206bfa9b250.avif',
  'de8436bb-e6a7-4c3c-8a68-4f30c7830193.avif',
  'fb1f1e23-3e24-4a65-8cad-878278de93b8.avif',
  'quarto.avif',
];

export function pickRandomQuartoSrc(): string {
  return `/quartos/${pick(QUARTO_FILES)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const PAGAMENTO_INICIO_SEG = 10 * 3600;
const PAGAMENTO_FIM_SEG = 12 * 3600;

export function generateRandomFields(): ReciboRandom {
  const totalSeg = PAGAMENTO_INICIO_SEG + Math.floor(Math.random() * (PAGAMENTO_FIM_SEG - PAGAMENTO_INICIO_SEG + 1));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return {
    idCode: `HM${randomAlnum(9)}`,
    confirmCode: randomAlnum(11),
    anfitriao: `${pick(PRIMEIRO_NOMES)} ${pick(SOBRENOMES)}`,
    horaPagamento: `${pad2(h)}:${pad2(m)}:${pad2(s)}`,
  };
}

const WEEKDAY_ABBR = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];
const MONTH_ABBR = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const MONTH_FULL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysISO(iso: string, dias: number): string {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() + dias);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function diffDaysISO(inicioISO: string, fimISO: string): number {
  const inicio = parseISO(inicioISO);
  const fim = parseISO(fimISO);
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((fim.getTime() - inicio.getTime()) / msPorDia);
}

export function formatRangeDate(iso: string): string {
  const dt = parseISO(iso);
  return `${WEEKDAY_ABBR[dt.getUTCDay()]}, ${dt.getUTCDate()} de ${MONTH_ABBR[dt.getUTCMonth()]} de ${dt.getUTCFullYear()}`;
}

export function formatIdDate(iso: string): string {
  const dt = parseISO(iso);
  const mes = MONTH_FULL[dt.getUTCMonth()];
  return `${dt.getUTCDate()} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${dt.getUTCFullYear()}`;
}

export function formatPaymentDate(iso: string, hora: string): string {
  const dt = parseISO(iso);
  return `${dt.getUTCDate()} de ${MONTH_FULL[dt.getUTCMonth()]} de ${dt.getUTCFullYear()} às ${hora} BRT`;
}

export function formatMoney(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMoneyBRL(n: number): string {
  return `R$ ${formatMoney(n)}`;
}

export function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}

export interface ReciboPricing {
  perNoite: number;
  subtotal: number;
  taxaServico: number;
  impostos: number;
  total: number;
}

export function computePricing(valorTotal: number, noites: number): ReciboPricing {
  const n = Math.max(1, noites);
  const subtotal = valorTotal;
  const perNoite = subtotal / n;
  const taxaServico = subtotal * SERVICE_FEE_RATE;
  const impostos = subtotal * TAX_RATE;
  const total = subtotal + taxaServico + impostos;
  return { perNoite, subtotal, taxaServico, impostos, total };
}

export function sanitizeFileName(n: string): string {
  return n.trim().replace(/[\\/:*?"<>|]/g, '');
}
