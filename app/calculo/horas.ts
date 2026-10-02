// Regras (confirmadas com o usuário):
//
// Não existe mais adicional noturno — só normal / 50% / 100%.
//
// Funcionário normal:
//   07:00–17:00 normal | 17:00–19:00 +50% | 19:00–07:00 (dia seguinte) +100%
//   Às 07:00 volta ao normal.
//
// Irata: sempre 12h fixas de trabalho a partir da entrada = normal; o que
//   exceder = 100% (nunca passa por uma faixa de 50%). O limite normal/100%
//   é fixo em entrada+12h — não se mexe por causa de refeição nem do horário
//   de entrada (100% só depois das 12h trabalhadas, independente da hora que
//   começou). Almoço e janta só descontam quando caem depois desse limite
//   (já na faixa de 100%); se caírem dentro das 12h fixas, não descontam
//   nada (o Irata recebe as 12h inteiras independentemente de quando comeu).
//
// Funcionário normal não entra nessa lógica de empurrar o limite: ele
// trabalha em horários fixos de relógio (não numa carga de 12h), então
// almoço/janta só definem de qual faixa (normal/50%/100%) sai o desconto.
//
// Almoço (11:30) e janta (20:30): sempre 1h, descontada da faixa em que o
// horário cai — só é descontada se a marcação realmente ocorre dentro do
// turno (entrada <= marcação < saída). A janta só é considerada se a saída
// for depois das 22:00 (saída às 21:00, por exemplo, não janta) — a não ser
// que tenha sido marcada à mão (`jantaManual`): aí basta as 20:30 caírem
// dentro do turno.
//
// Final de semana e feriado (nacional + específicos do RJ, ver feriados.js):
// o turno inteiro vira 100% (não passa pelas faixas de horário normal/50%
// nem pela lógica das 12h fixas do Irata) — vale tanto pro Normal quanto pro
// Irata. Se o feriado detectado não deveria valer pro turno (ex.: feriado
// municipal que não se aplica), dá pra desativar via `ignorarFeriado` e ele
// volta a calcular como dia normal.

import { isFimDeSemana, getFeriado, type Feriado } from './feriados';

const DAY = 1440; // minutos em 24h

export type TipoTrabalho = 'normal' | 'irata';

export interface CalcularHorasParams {
  tipo: TipoTrabalho;
  entrada: string;
  saida: string;
  data: string;
  dataSaida?: string;
  ignorarFeriado?: boolean;
  descontarAlmoco?: boolean;
  descontarJanta?: boolean;
  // Janta marcada à mão: desconta mesmo com saída até as 22:00.
  jantaManual?: boolean;
}

export interface Descontos {
  almoco: boolean;
  janta: boolean;
}

export interface ResultadoHoras {
  brutoMin: number;
  descontoMin: number;
  descontos: Descontos;
  normalMin: number;
  cinquentaMin: number;
  cemMin: number;
  totalPagoMin: number;
  cruzaMeiaNoite: boolean;
  fimDeSemana: boolean;
  feriado: Feriado | null;
  feriadoIgnorado: boolean;
  diaEspecial: boolean;
}

type Bucket = 'normal' | 'cinquenta' | 'cem';

interface Buckets {
  normal: number;
  cinquenta: number;
  cem: number;
}

interface PontoRefeicao {
  abs: number;
  tipo: 'almoco' | 'janta';
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Arredonda um horário (em minutos absolutos) para a hora cheia mais
// próxima: minutos até 30 descem para a hora cheia anterior, de 31 em
// diante sobem para a próxima (ex.: 21:30 -> 21:00, 21:31 -> 22:00).
function arredondarParaHoraCheia(min: number): number {
  const resto = ((min % 60) + 60) % 60;
  const base = min - resto;
  return resto <= 30 ? base : base + 60;
}

export function arredondarHorario(hhmm: string): string {
  const min = ((arredondarParaHoraCheia(toMin(hhmm)) % DAY) + DAY) % DAY;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:00`;
}

function toDayIndex(dataStr: string): number {
  const [y, m, d] = dataStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function classifyPointNormal(abs: number): Bucket {
  const tod = ((abs % DAY) + DAY) % DAY;
  if (tod >= 420 && tod < 1020) return 'normal'; // 07:00-17:00
  if (tod >= 1020 && tod < 1140) return 'cinquenta'; // 17:00-19:00
  return 'cem'; // 19:00-07:00 (dia seguinte)
}

function dayIndexRange(startAbs: number, endAbs: number): number[] {
  const d0 = Math.floor(startAbs / DAY) - 1;
  const d1 = Math.floor(endAbs / DAY) + 1;
  const days: number[] = [];
  for (let d = d0; d <= d1; d++) days.push(d);
  return days;
}

function segmentBandsNormal(startAbs: number, endAbs: number): Buckets {
  const patternPoints = [420, 1020, 1140];
  const boundariesSet = new Set<number>([startAbs, endAbs]);
  for (const d of dayIndexRange(startAbs, endAbs)) {
    for (const p of patternPoints) {
      const abs = d * DAY + p;
      if (abs > startAbs && abs < endAbs) boundariesSet.add(abs);
    }
  }
  const boundaries = Array.from(boundariesSet).sort((a, b) => a - b);
  const buckets: Buckets = { normal: 0, cinquenta: 0, cem: 0 };
  for (let i = 0; i < boundaries.length - 1; i++) {
    const a = boundaries[i];
    const b = boundaries[i + 1];
    if (b <= a) continue;
    buckets[classifyPointNormal(a)] += b - a;
  }
  return buckets;
}

function pontosRefeicao(
  startAbs: number,
  endAbs: number,
  descontarAlmoco: boolean,
  descontarJanta: boolean,
  jantaManual: boolean,
): PontoRefeicao[] {
  const pontos: PontoRefeicao[] = [];
  for (const d of dayIndexRange(startAbs, endAbs)) {
    const almoco = d * DAY + 690; // 11:30
    const janta = d * DAY + 1230; // 20:30
    const jantaLimite = d * DAY + 1320; // 22:00 — janta só conta se a saída for depois disso
    if (descontarAlmoco && almoco >= startAbs && almoco < endAbs) pontos.push({ abs: almoco, tipo: 'almoco' });
    if (descontarJanta && janta >= startAbs && janta < endAbs && (jantaManual || endAbs > jantaLimite)) {
      pontos.push({ abs: janta, tipo: 'janta' });
    }
  }
  return pontos;
}

type Turno = Pick<CalcularHorasParams, 'entrada' | 'saida' | 'data' | 'dataSaida'>;

function intervaloDoTurno({ entrada, saida, data, dataSaida }: Turno) {
  // Entrada e saída são arredondadas para a hora cheia antes de qualquer
  // cálculo (até 30 min desce, de 31 em diante sobe) — o resultado final já
  // sai considerando os horários arredondados.
  const entradaMin = arredondarParaHoraCheia(toMin(entrada));
  const saidaMinRaw = toMin(saida);

  // Se a data de saída for informada, ela manda — o cruzamento de meia-noite
  // deixa de ser um "adivinhado" pela comparação de horários e passa a ser a
  // diferença real de dias entre as duas datas (permite inclusive turnos com
  // mais de 24h). Sem data de saída, cai no comportamento antigo: infere que
  // cruzou a meia-noite quando a saída é <= a entrada.
  const dias = dataSaida ? toDayIndex(dataSaida) - toDayIndex(data) : saidaMinRaw <= entradaMin ? 1 : 0;
  const saidaMin = arredondarParaHoraCheia(dias * DAY + saidaMinRaw);
  return { entradaMin, saidaMin, cruzaMeiaNoite: dias > 0 };
}

// Regra automática da janta: 20:30 dentro do turno e saída depois das 22:00.
export function jantaAutomatica(turno: Turno): boolean {
  const { entradaMin, saidaMin } = intervaloDoTurno(turno);
  return saidaMin > entradaMin && pontosRefeicao(entradaMin, saidaMin, false, true, false).length > 0;
}

export function calcularHoras({
  tipo,
  entrada,
  saida,
  data,
  dataSaida,
  ignorarFeriado = false,
  descontarAlmoco = true,
  descontarJanta = false,
  jantaManual = false,
}: CalcularHorasParams): ResultadoHoras {
  const { entradaMin, saidaMin, cruzaMeiaNoite } = intervaloDoTurno({ entrada, saida, data, dataSaida });

  if (saidaMin <= entradaMin) {
    throw new Error('A data/hora de saída deve ser depois da entrada.');
  }

  const pontos = pontosRefeicao(entradaMin, saidaMin, descontarAlmoco, descontarJanta, jantaManual);

  const fimDeSemana = isFimDeSemana(data);
  const feriado = getFeriado(data);
  const feriadoAtivo = !!feriado && !ignorarFeriado;
  const diaEspecial = fimDeSemana || feriadoAtivo;

  let buckets: Buckets;
  let limiteNormalAbs: number | null = null;

  if (diaEspecial) {
    buckets = { normal: 0, cinquenta: 0, cem: saidaMin - entradaMin };
  } else if (tipo === 'irata') {
    limiteNormalAbs = entradaMin + 720;
    const normal = Math.max(0, Math.min(saidaMin, limiteNormalAbs) - entradaMin);
    const cem = Math.max(0, saidaMin - Math.max(entradaMin, limiteNormalAbs));
    buckets = { normal, cinquenta: 0, cem };
  } else {
    buckets = segmentBandsNormal(entradaMin, saidaMin);
  }

  const descontos: Descontos = { almoco: false, janta: false };
  for (const p of pontos) {
    // Dentro das 12h fixas do Irata, refeição não desconta — só depois do limite (na faixa de 100%).
    if (!diaEspecial && tipo === 'irata' && p.abs < (limiteNormalAbs as number)) continue;
    const bucket: Bucket = diaEspecial ? 'cem' : tipo === 'irata' ? 'cem' : classifyPointNormal(p.abs);
    const desconto = Math.min(60, buckets[bucket]);
    buckets[bucket] -= desconto;
    if (p.tipo === 'almoco') descontos.almoco = true;
    else descontos.janta = true;
  }

  const brutoMin = saidaMin - entradaMin;
  const descontoMin = (descontos.almoco ? 60 : 0) + (descontos.janta ? 60 : 0);
  const totalPagoMin = buckets.normal + buckets.cinquenta + buckets.cem;

  return {
    brutoMin,
    descontoMin,
    descontos,
    normalMin: buckets.normal,
    cinquentaMin: buckets.cinquenta,
    cemMin: buckets.cem,
    totalPagoMin,
    cruzaMeiaNoite,
    fimDeSemana,
    feriado,
    feriadoIgnorado: !!feriado && ignorarFeriado,
    diaEspecial,
  };
}

export function decHoras(min: number): string {
  return (min / 60).toFixed(2).replace('.', ',');
}

export function hmHoras(min: number): string {
  const sign = min < 0 ? '-' : '';
  const abs = Math.round(Math.abs(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}
