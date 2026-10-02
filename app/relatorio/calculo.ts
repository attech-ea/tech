// Regras do relatório (confirmadas com o usuário):
//
// Dias: o relatório tem um ou mais dias de trabalho (data + horário de cada
// um). Cada colaborador informa em quais dias trabalhou (`ItemInput.dias`, posições
// em `dias`); as horas e as refeições dele são somadas só nesses dias e a
// diária Irata vale por dia trabalhado. Quilometragem
// e deslocamento contam uma vez por relatório (a viagem de ida e volta).
//
// Horas: reaproveita `calcularHoras` da aba Cálculo de Horas (arredondamento,
// fim de semana/feriado = 100%, regra de 12h fixas para funções Irata,
// desconto de almoço/janta). Aqui não existe a faixa de 50%: o que cairia
// nela (17:00–19:00) é pago como hora 100%.
//
// Preço conforme a função exercida naquele trabalho:
// - Normal: preço por hora; a hora 100% vale o dobro.
// - Irata: o preço é a diária fixa das 12h (paga inteira sempre que houver
//   horas normais). A hora 100% é o dobro da diária/12 arredondada ao
//   múltiplo de 50 mais próximo (N1: 2000/12 = 166,67 → 150 → 300/h).
//
// Refeições: almoço/jantar marcados descontam a hora (como na aba de Cálculo)
// e valem em todos os dias. O preço fixo das refeições não entra no valor da
// linha: sai num bloco próprio de alimentação, somado só no total do
// relatório. O jantar só vale nos dias em que a saída é depois das 20:30 (ou o
// turno passa da meia-noite).
//
// Alimentação: o valor sai das refeições marcadas, mas pode ser substituído por
// um valor informado na tela (`alimentacaoManual`, ex.: soma de notas fiscais).
//
// Deslocamento: lista de viagens (ida, volta e as que forem adicionadas), cada
// uma com data e horário, feitas por toda a equipe. Vale a regra de horas do
// dia de trabalho, sem faixa de 50%: normal só em dia útil das 07:00 às 17:00;
// fim de semana, feriado e o que passa das 17:00 (até as 07:00) é 100%. Preço/hora
// do tipo definido na função (comum ou técnico); a hora 100% vale o dobro.
// `deslocamentoHoras` é legado: relatórios antigos tinham 10h fixas, sem viagens.
//
// Quilometragem: distância informada na tela × preço/km.
//
// Material: valor único informado na tela (0 = sem material). Sai num bloco
// próprio do PDF, depois da equipe, e entra no total do relatório.
//
// Tudo é calculado em centavos para evitar erro de ponto flutuante.

import { calcularHoras, type ResultadoHoras } from '../calculo/horas';
import { getFeriado, isFimDeSemana } from '../calculo/feriados';

export type TipoDeslocamento = 'COMUM' | 'TECNICO';

export const TIPO_DESLOCAMENTO_LABEL: Record<TipoDeslocamento, string> = {
  COMUM: 'Comum',
  TECNICO: 'Técnico',
};

export const MULTIPLICADOR_CEM = 2;
export const HORARIO_MIN_JANTAR = '20:30';
const HORAS_DIARIA_IRATA = 12;
const ARREDONDAMENTO_IRATA = 50;

export interface Parametros {
  kmQuantidade: number;
  kmPreco: number;
  // Legado (relatórios anteriores às viagens); os novos gravam 0.
  deslocamentoHoras: number;
  deslocPrecoComum: number;
  deslocPrecoTecnico: number;
  precoAlmoco: number;
  precoJantar: number;
  // Valor da alimentação informado à mão; `null` usa o das refeições marcadas.
  alimentacaoManual: number | null;
  material: number;
}

export const PARAMETROS_PADRAO: Parametros = {
  kmQuantidade: 700,
  kmPreco: 3.3,
  deslocamentoHoras: 0,
  deslocPrecoComum: 400,
  deslocPrecoTecnico: 600,
  precoAlmoco: 30,
  precoJantar: 30,
  alimentacaoManual: null,
  material: 0,
};

// Ida (dia anterior ao trabalho) e volta (dia posterior) começam com este horário.
export const DESLOCAMENTO_ENTRADA_PADRAO = '07:00';
export const DESLOCAMENTO_SAIDA_PADRAO = '12:00';
export const ROTULO_IDA = 'Ida';
export const ROTULO_VOLTA = 'Volta';
export const ROTULO_DESLOCAMENTO = 'Deslocamento';
const INICIO_NORMAL_MIN = 7 * 60;
const FIM_NORMAL_MIN = 17 * 60;

// Um dia de trabalho da equipe; `dataSaida` avança quando o turno cruza a meia-noite.
export interface DiaInput {
  data: string;
  dataSaida: string;
  entrada: string;
  saida: string;
  ignorarFeriado: boolean;
}

// Uma viagem da equipe; `dataSaida` avança quando ela cruza a meia-noite.
export interface DeslocamentoInput extends DiaInput {
  rotulo: string;
}

export interface ItemInput {
  // Por hora (função normal) ou diária de 12h (função Irata).
  preco: number;
  irata: boolean;
  tipoDeslocamento: TipoDeslocamento;
  // Posições (em ordem crescente) dos dias do relatório em que o colaborador trabalhou.
  dias: number[];
  almoco: boolean;
  jantar: boolean;
}

// O que um colaborador rendeu em um dia trabalhado (`dia` é a posição em `dias`).
export interface DiaCalculado {
  dia: number;
  normalMin: number;
  cemMin: number;
  totalCent: number;
  almoco: boolean;
  jantar: boolean;
}

export interface ItemCalculado {
  // Um resultado por dia trabalhado, na ordem de `item.dias`.
  horas: ResultadoHoras[];
  porDia: DiaCalculado[];
  normalMin: number;
  cemMin: number;
  valorNormalCent: number;
  valorCemCent: number;
  // Refeições que valem de fato, somadas nos dias (jantar só nos dias com saída tarde).
  almocos: number;
  jantares: number;
  // Só horas; alimentação fica de fora.
  totalCent: number;
}

export interface AlimentacaoDia {
  almocos: number;
  jantares: number;
  almocoCent: number;
  jantarCent: number;
  totalCent: number;
}

export interface Alimentacao {
  // Uma entrada por dia do relatório, na mesma ordem de `dias`.
  porDia: AlimentacaoDia[];
  almocos: number;
  jantares: number;
  precoAlmoco: number;
  precoJantar: number;
  almocoCent: number;
  jantarCent: number;
  // Valor das refeições marcadas; `totalCent` é ele, ou o valor informado (`manual`).
  automaticoCent: number;
  manual: boolean;
  totalCent: number;
}

export interface GrupoDeslocamento {
  colaboradores: number;
  precoHora: number;
  // Horas de todas as pessoas do grupo, somadas nas viagens.
  normalMin: number;
  cemMin: number;
  totalCent: number;
}

export interface ViagemCalculada {
  rotulo: string;
  // `null` no deslocamento fixo dos relatórios antigos.
  dia: DeslocamentoInput | null;
  // Horas de uma pessoa nesta viagem.
  normalMin: number;
  cemMin: number;
  comumCent: number;
  tecnicoCent: number;
}

export interface RelatorioCalculado {
  itens: (ItemCalculado | null)[];
  subtotalColaboradoresCent: number;
  materialCent: number;
  alimentacao: Alimentacao;
  km: { quantidade: number; preco: number; totalCent: number };
  deslocamento: {
    viagens: ViagemCalculada[];
    comum: GrupoDeslocamento;
    tecnico: GrupoDeslocamento;
    totalCent: number;
  };
  totalCent: number;
}

export function toCent(reais: number): number {
  return Math.round(reais * 100);
}

export function precoHoraCem(item: Pick<ItemInput, 'preco' | 'irata'>): number {
  if (!item.irata) return item.preco * MULTIPLICADOR_CEM;
  const hora = Math.round(item.preco / HORAS_DIARIA_IRATA / ARREDONDAMENTO_IRATA) * ARREDONDAMENTO_IRATA;
  return hora * MULTIPLICADOR_CEM;
}

export function formatPrecoNormal(item: Pick<ItemInput, 'preco' | 'irata'>): string {
  return `${brl.format(item.preco)}/${item.irata ? `${HORAS_DIARIA_IRATA}h` : 'h'}`;
}

export function formatPrecoCem(item: Pick<ItemInput, 'preco' | 'irata'>): string {
  return `${brl.format(precoHoraCem(item))}/h`;
}

function toDayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function somarDias(iso: string, dias: number): string {
  return new Date((toDayIndex(iso) + dias) * 86400000).toISOString().slice(0, 10);
}

// A data de saída avança um dia quando a saída é antes/igual à entrada.
export function dataSaidaAuto(data: string, entrada: string, saida: string): string {
  if (!data || !entrada || !saida) return data;
  if (saida > entrada) return data;
  return somarDias(data, 1);
}

export function jantarPermitido(data: string, dataSaida: string, saida: string): boolean {
  return dataSaida > data || saida > HORARIO_MIN_JANTAR;
}

// Posição do primeiro dia que começa antes de o anterior terminar, ou -1.
export function diaSobreposto(dias: Pick<DiaInput, 'data' | 'dataSaida' | 'entrada' | 'saida'>[]): number {
  const ordenados = dias
    .map((d, i) => ({ i, inicio: `${d.data}T${d.entrada}`, fim: `${d.dataSaida}T${d.saida}` }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let n = 1; n < ordenados.length; n++) {
    if (ordenados[n].inicio < ordenados[n - 1].fim) return ordenados[n].i;
  }
  return -1;
}

export function calcularItem(item: ItemInput, diasRelatorio: DiaInput[]): ItemCalculado {
  const r: ItemCalculado = {
    horas: [],
    porDia: [],
    normalMin: 0,
    cemMin: 0,
    valorNormalCent: 0,
    valorCemCent: 0,
    almocos: 0,
    jantares: 0,
    totalCent: 0,
  };

  for (const posicao of item.dias) {
    const dia = diasRelatorio[posicao];
    if (!dia) throw new Error('Dia inexistente no relatório.');
    const jantar = !!item.jantar && jantarPermitido(dia.data, dia.dataSaida, dia.saida);
    const horas = calcularHoras({
      tipo: item.irata ? 'irata' : 'normal',
      entrada: dia.entrada,
      saida: dia.saida,
      data: dia.data,
      dataSaida: dia.dataSaida,
      ignorarFeriado: dia.ignorarFeriado,
      descontarAlmoco: item.almoco,
      descontarJanta: jantar,
    });

    const normalMin = horas.normalMin;
    const cemMin = horas.cinquentaMin + horas.cemMin;
    const valorNormalCent = item.irata
      ? normalMin > 0
        ? toCent(item.preco)
        : 0
      : Math.round((toCent(item.preco) * normalMin) / 60);
    const valorCemCent = Math.round((toCent(precoHoraCem(item)) * cemMin) / 60);
    r.horas.push(horas);
    r.porDia.push({
      dia: posicao,
      normalMin,
      cemMin,
      totalCent: valorNormalCent + valorCemCent,
      almoco: !!item.almoco,
      jantar,
    });
    r.normalMin += normalMin;
    r.cemMin += cemMin;
    r.valorNormalCent += valorNormalCent;
    r.valorCemCent += valorCemCent;
    if (item.almoco) r.almocos++;
    if (jantar) r.jantares++;
  }

  r.totalCent = r.valorNormalCent + r.valorCemCent;
  return r;
}

// Horas de uma pessoa em uma viagem: normal só em dia útil (sem feriado) entre
// 07:00 e 17:00; o resto (noite, madrugada, fim de semana, feriado) é 100%.
export function horasDeslocamento(v: DiaInput): { normalMin: number; cemMin: number } {
  const inicio = toDayIndex(v.data) * 1440 + toMin(v.entrada);
  const fim = toDayIndex(v.dataSaida) * 1440 + toMin(v.saida);
  if (!(fim > inicio)) throw new Error('A saída deve ser depois da entrada.');

  const cortes = new Set([inicio, fim]);
  for (let d = Math.floor(inicio / 1440); d <= Math.floor(fim / 1440); d++) {
    for (const c of [d * 1440, d * 1440 + INICIO_NORMAL_MIN, d * 1440 + FIM_NORMAL_MIN]) {
      if (c > inicio && c < fim) cortes.add(c);
    }
  }
  const pontos = [...cortes].sort((a, b) => a - b);

  let normalMin = 0;
  let cemMin = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const dia = Math.floor(a / 1440);
    const iso = new Date(dia * 86400000).toISOString().slice(0, 10);
    const especial = isFimDeSemana(iso) || (!!getFeriado(iso) && !v.ignorarFeriado);
    const hora = a - dia * 1440;
    const normal = !especial && hora >= INICIO_NORMAL_MIN && hora < FIM_NORMAL_MIN;
    if (normal) normalMin += pontos[i + 1] - a;
    else cemMin += pontos[i + 1] - a;
  }
  return { normalMin, cemMin };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function valorHorasCent(normalMin: number, cemMin: number, precoHora: number): number {
  return (
    Math.round((toCent(precoHora) * normalMin) / 60) +
    Math.round((toCent(precoHora) * MULTIPLICADOR_CEM * cemMin) / 60)
  );
}

// Itens com algum dia de horário inválido saem como `null` e não entram no total;
// o mesmo vale para viagens com horário inválido.
export function calcularRelatorio(
  itens: ItemInput[],
  dias: DiaInput[],
  params: Parametros,
  deslocamentos: DeslocamentoInput[] = [],
): RelatorioCalculado {
  const calculados = itens.map((item) => {
    try {
      return calcularItem(item, dias);
    } catch {
      return null;
    }
  });

  const subtotalColaboradoresCent = calculados.reduce((acc, c) => acc + (c?.totalCent ?? 0), 0);

  const almocos = calculados.reduce((acc, c) => acc + (c?.almocos ?? 0), 0);
  const jantares = calculados.reduce((acc, c) => acc + (c?.jantares ?? 0), 0);
  const almocoCent = almocos * toCent(params.precoAlmoco);
  const jantarCent = jantares * toCent(params.precoJantar);
  const porDia: AlimentacaoDia[] = dias.map((_, n) => {
    const doDia = calculados.flatMap((c) => c?.porDia.filter((p) => p.dia === n) ?? []);
    const almocosDia = doDia.filter((p) => p.almoco).length;
    const jantaresDia = doDia.filter((p) => p.jantar).length;
    const almocoDiaCent = almocosDia * toCent(params.precoAlmoco);
    const jantarDiaCent = jantaresDia * toCent(params.precoJantar);
    return {
      almocos: almocosDia,
      jantares: jantaresDia,
      almocoCent: almocoDiaCent,
      jantarCent: jantarDiaCent,
      totalCent: almocoDiaCent + jantarDiaCent,
    };
  });
  const alimentacao: Alimentacao = {
    porDia,
    almocos,
    jantares,
    precoAlmoco: params.precoAlmoco,
    precoJantar: params.precoJantar,
    almocoCent,
    jantarCent,
    automaticoCent: almocoCent + jantarCent,
    manual: params.alimentacaoManual != null,
    totalCent: params.alimentacaoManual != null ? toCent(params.alimentacaoManual) : almocoCent + jantarCent,
  };

  const materialCent = toCent(params.material || 0);
  const kmTotalCent = Math.round(params.kmQuantidade * toCent(params.kmPreco));

  const qtdTecnico = itens.filter((i) => i.tipoDeslocamento === 'TECNICO').length;
  const qtdComum = itens.length - qtdTecnico;

  const viagens: ViagemCalculada[] = [];
  if (params.deslocamentoHoras > 0) {
    // Relatório antigo: horas fixas, sem data nem horário.
    const normalMin = Math.round(params.deslocamentoHoras * 60);
    viagens.push({
      rotulo: 'Ida e volta',
      dia: null,
      normalMin,
      cemMin: 0,
      comumCent: qtdComum * valorHorasCent(normalMin, 0, params.deslocPrecoComum),
      tecnicoCent: qtdTecnico * valorHorasCent(normalMin, 0, params.deslocPrecoTecnico),
    });
  }
  for (const dia of deslocamentos) {
    try {
      const { normalMin, cemMin } = horasDeslocamento(dia);
      viagens.push({
        rotulo: dia.rotulo,
        dia,
        normalMin,
        cemMin,
        comumCent: qtdComum * valorHorasCent(normalMin, cemMin, params.deslocPrecoComum),
        tecnicoCent: qtdTecnico * valorHorasCent(normalMin, cemMin, params.deslocPrecoTecnico),
      });
    } catch {
      // Horário inválido: a viagem fica de fora até ser corrigida.
    }
  }
  const grupo = (colaboradores: number, precoHora: number, campo: 'comumCent' | 'tecnicoCent'): GrupoDeslocamento => ({
    colaboradores,
    precoHora,
    normalMin: colaboradores * viagens.reduce((acc, v) => acc + v.normalMin, 0),
    cemMin: colaboradores * viagens.reduce((acc, v) => acc + v.cemMin, 0),
    totalCent: viagens.reduce((acc, v) => acc + v[campo], 0),
  });
  const comum = grupo(qtdComum, params.deslocPrecoComum, 'comumCent');
  const tecnico = grupo(qtdTecnico, params.deslocPrecoTecnico, 'tecnicoCent');
  const deslocTotalCent = comum.totalCent + tecnico.totalCent;

  return {
    itens: calculados,
    subtotalColaboradoresCent,
    materialCent,
    alimentacao,
    km: { quantidade: params.kmQuantidade, preco: params.kmPreco, totalCent: kmTotalCent },
    deslocamento: { viagens, comum, tecnico, totalCent: deslocTotalCent },
    totalCent: subtotalColaboradoresCent + materialCent + alimentacao.totalCent + kmTotalCent + deslocTotalCent,
  };
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCent(cent: number): string {
  return brl.format(cent / 100);
}

export function formatReais(reais: number): string {
  return brl.format(reais);
}

// "YYYY-MM-DD" de hoje no horário de Brasília (en-CA formata como ISO).
export function hojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function formatDataISO(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// "DD/MM/AA HH:MM às HH:MM" (ou com a data de saída, se o turno passa da meia-noite).
export function formatPeriodo(d: Pick<DiaInput, 'data' | 'dataSaida' | 'entrada' | 'saida'>): string {
  const fim = d.dataSaida === d.data ? d.saida : formatDataHora(d.dataSaida, d.saida);
  return `${formatDataHora(d.data, d.entrada)} às ${fim}`;
}

// "DD/MM/AA HH:MM", para mostrar o período de cada colaborador.
export function formatDataHora(iso: string, hora: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)} ${hora}`;
}
