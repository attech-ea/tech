// Feriados considerados no cálculo: nacionais (padrão, valem em qualquer
// lugar) + os específicos do Rio de Janeiro (estado/município), que era o
// que estava sendo checado manualmente em feriados.com.br/RJ/Rio de Janeiro.
//
// Móveis (Carnaval, Sexta-feira Santa, Corpus Christi) são calculados a
// partir da Páscoa (algoritmo de Meeus/Jones/Butcher), então funciona pra
// qualquer ano sem precisar atualizar a lista.

export interface Feriado {
  data: string;
  nome: string;
}

interface FeriadoFixo {
  mes: number;
  dia: number;
  nome: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function addDias(date: Date, dias: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + dias);
  return d;
}

function dateParaISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// { mes, dia } — 1-indexado
const FERIADOS_FIXOS_NACIONAIS: FeriadoFixo[] = [
  { mes: 1, dia: 1, nome: 'Confraternização Universal' },
  { mes: 4, dia: 21, nome: 'Tiradentes' },
  { mes: 5, dia: 1, nome: 'Dia do Trabalho' },
  { mes: 9, dia: 7, nome: 'Independência do Brasil' },
  { mes: 10, dia: 12, nome: 'Nossa Senhora Aparecida' },
  { mes: 11, dia: 2, nome: 'Finados' },
  { mes: 11, dia: 15, nome: 'Proclamação da República' },
  { mes: 11, dia: 20, nome: 'Consciência Negra' },
  { mes: 12, dia: 25, nome: 'Natal' },
];

// Específicos do Rio de Janeiro (estado + município), fora do padrão nacional.
const FERIADOS_FIXOS_RJ: FeriadoFixo[] = [
  { mes: 1, dia: 20, nome: 'São Sebastião (Rio de Janeiro)' },
  { mes: 4, dia: 23, nome: 'São Jorge (RJ)' },
];

const cache = new Map<number, Feriado[]>();

function feriadosDoAno(ano: number): Feriado[] {
  const cached = cache.get(ano);
  if (cached) return cached;

  const lista: Feriado[] = [];
  for (const f of FERIADOS_FIXOS_NACIONAIS) {
    lista.push({ data: `${ano}-${pad2(f.mes)}-${pad2(f.dia)}`, nome: f.nome });
  }
  for (const f of FERIADOS_FIXOS_RJ) {
    lista.push({ data: `${ano}-${pad2(f.mes)}-${pad2(f.dia)}`, nome: f.nome });
  }

  const pascoaAno = pascoa(ano);
  lista.push({ data: dateParaISO(addDias(pascoaAno, -48)), nome: 'Carnaval (segunda-feira)' });
  lista.push({ data: dateParaISO(addDias(pascoaAno, -47)), nome: 'Carnaval (terça-feira)' });
  lista.push({ data: dateParaISO(addDias(pascoaAno, -2)), nome: 'Sexta-feira Santa' });
  lista.push({ data: dateParaISO(addDias(pascoaAno, 60)), nome: 'Corpus Christi' });

  cache.set(ano, lista);
  return lista;
}

export function getFeriado(dataISO: string | null | undefined): Feriado | null {
  if (!dataISO) return null;
  const ano = Number(dataISO.slice(0, 4));
  if (!ano) return null;
  return feriadosDoAno(ano).find((f) => f.data === dataISO) || null;
}

export function isFimDeSemana(dataISO: string | null | undefined): boolean {
  if (!dataISO) return false;
  const [y, m, d] = dataISO.split('-').map(Number);
  if (!y || !m || !d) return false;
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}
