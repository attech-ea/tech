import { jsPDF } from 'jspdf';
import { autoTable, type CellHookData, type UserOptions } from 'jspdf-autotable';
import {
  calcularRelatorio,
  formatCent,
  formatDataHora,
  formatDataISO,
  formatPeriodo,
  formatPrecoNormal,
  formatReais,
  MULTIPLICADOR_CEM,
  toCent,
} from './calculo';
import { hmHoras } from '../calculo/horas';
import { EMPRESA } from './empresa';
import type { RelatorioDTO, RelatorioItemDTO } from './tipos';

type Cor = [number, number, number];

// Mesmos tokens da tela (design system do CRM): azul da logo Attech e a escala
// neutral do Tailwind para textos e linhas.
const ATTECH: Cor = [5, 62, 113]; // #053e71, azul da logo
const N900: Cor = [23, 23, 23];
const N800: Cor = [38, 38, 38];
const N500: Cor = [115, 115, 115];
const N400: Cor = [163, 163, 163];
const N300: Cor = [212, 212, 212];
const N200: Cor = [229, 229, 229];
const N100: Cor = [245, 245, 245];
const N50: Cor = [250, 250, 250];

const MARGEM = 14;
const RAIO = 2;
const LOGO_ALTURA = 18;
const LOGO_LARGURA_MAX = 40;

// "DD/MM/AA - HH:MM", como aparece nas colunas de entrada e saída.
function dataHoraColuna(iso: string, hora: string): string {
  return formatDataHora(iso, hora).replace(' ', ' - ');
}

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

async function carregarImagem(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// A pré-visualização gera o PDF a cada alteração; a logo é baixada uma vez só.
let logoCache: Promise<string | null> | null = null;

function carregarLogo(): Promise<string | null> {
  logoCache ??= carregarImagem(EMPRESA.logoUrl).then((logo) => {
    if (!logo) logoCache = null;
    return logo;
  });
  return logoCache;
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function texto(doc: jsPDF, cor: Cor, tamanho: number, estilo: 'normal' | 'bold' = 'normal') {
  doc.setTextColor(...cor);
  doc.setFontSize(tamanho);
  doc.setFont('helvetica', estilo);
}

// Título da seção, no mesmo formato do SectionHead da tela.
function tituloSecao(doc: jsPDF, titulo: string, y: number): number {
  texto(doc, ATTECH, 11, 'bold');
  doc.text(titulo, MARGEM, y);
  return y + 3.5;
}

// Estilo comum das tabelas: cabeçalho neutro, linhas separadas só por divisórias.
function estiloTabela(fontSize: number, cellPadding: number): Partial<UserOptions> {
  return {
    margin: { left: MARGEM, right: MARGEM, bottom: 20 },
    theme: 'plain',
    styles: { fontSize, cellPadding, textColor: N800, lineColor: N200, valign: 'middle' },
    headStyles: { fillColor: N100, textColor: N500, fontStyle: 'bold', fontSize: fontSize - 0.5 },
    bodyStyles: { lineWidth: { bottom: 0.2 } },
    footStyles: { fillColor: N50, textColor: N900, fontStyle: 'bold', lineWidth: { top: 0.4 }, lineColor: N300 },
  };
}

// Desenha o logo mantendo a proporção; devolve a largura ocupada (0 se não houver).
function desenharLogo(doc: jsPDF, logo: string | null): number {
  if (!logo) return 0;
  try {
    const props = doc.getImageProperties(logo);
    let h = LOGO_ALTURA;
    let w = (props.width / props.height) * h;
    if (w > LOGO_LARGURA_MAX) {
      w = LOGO_LARGURA_MAX;
      h = (props.height / props.width) * w;
    }
    doc.addImage(logo, props.fileType, MARGEM, 10 + (LOGO_ALTURA - h) / 2, w, h, 'logo', 'FAST');
    return w;
  } catch {
    return 0;
  }
}

function novaPaginaSePreciso(doc: jsPDF, y: number, espaco: number): number {
  if (y > doc.internal.pageSize.getHeight() - espaco) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function gerarRelatorioPdf(relatorio: RelatorioDTO): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const larguraUtil = largura - 2 * MARGEM;
  const { dias } = relatorio;
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];
  const calc = calcularRelatorio(relatorio.itens, dias, relatorio.params, relatorio.deslocamentos);

  // ---------- Cabeçalho da empresa ----------
  const larguraLogo = desenharLogo(doc, await carregarLogo());
  const xTexto = larguraLogo ? MARGEM + larguraLogo + 5 : MARGEM;
  texto(doc, N900, 11, 'bold');
  doc.text(EMPRESA.razaoSocial, xTexto, 15);
  texto(doc, N500, 8);
  doc.text(`CNPJ ${EMPRESA.cnpj}`, xTexto, 20);
  doc.text(EMPRESA.endereco, xTexto, 24);

  doc.setDrawColor(...N200);
  doc.setLineWidth(0.3);
  doc.line(MARGEM, 33, largura - MARGEM, 33);

  // ---------- Resumo do trabalho: faixa com início, término, dias e equipe ----------
  const yFaixa = 38;
  const linhasDescricao: string[] = relatorio.descricao
    ? doc.setFontSize(9).splitTextToSize(relatorio.descricao, larguraUtil - 10)
    : [];
  const alturaDescricao = linhasDescricao.length ? 7 + linhasDescricao.length * 3.9 : 0;
  const alturaFaixa = 16 + alturaDescricao;

  doc.setFillColor(...N50);
  doc.setDrawColor(...N200);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGEM, yFaixa, larguraUtil, alturaFaixa, RAIO, RAIO, 'FD');

  const colunas = [
    { rotulo: 'Entrada', valor: `${formatDataISO(primeiro.data)}  ${primeiro.entrada}` },
    { rotulo: 'Saída', valor: `${formatDataISO(ultimo.dataSaida)}  ${ultimo.saida}` },
    ...(dias.length > 1 ? [{ rotulo: 'Dias', valor: String(dias.length) }] : []),
    {
      rotulo: 'Equipe',
      valor: `${relatorio.itens.length} ${relatorio.itens.length === 1 ? 'colaborador' : 'colaboradores'}`,
    },
  ];
  const larguraColuna = larguraUtil / colunas.length;
  colunas.forEach((c, i) => {
    const x = MARGEM + 5 + i * larguraColuna;
    if (i > 0) {
      doc.setDrawColor(...N200);
      doc.line(x - 5, yFaixa + 3.5, x - 5, yFaixa + 12.5);
    }
    texto(doc, N500, 7.5);
    doc.text(c.rotulo, x, yFaixa + 6);
    texto(doc, N900, 10, 'bold');
    doc.text(c.valor, x, yFaixa + 11.5);
  });

  if (linhasDescricao.length) {
    const yDescricao = yFaixa + 16;
    doc.setDrawColor(...N200);
    doc.line(MARGEM + 5, yDescricao, largura - MARGEM - 5, yDescricao);
    texto(doc, N500, 7.5);
    doc.text('Descrição', MARGEM + 5, yDescricao + 4.5);
    texto(doc, N800, 9);
    doc.text(linhasDescricao, MARGEM + 5, yDescricao + 8.8);
  }

  // ---------- Equipe ----------
  let y = tituloSecao(doc, 'Equipe', yFaixa + alturaFaixa + 10);

  type ColunaEquipe = {
    titulo: string;
    halign?: 'center' | 'right';
    largura?: number;
    estilo?: { textColor: Cor; fontStyle: 'bold' };
    valor: (item: RelatorioItemDTO, total: string) => string;
  };
  type LinhaEquipe = { item: RelatorioItemDTO; total: string };

  function tabelaEquipe(
    startY: number,
    colunasEquipe: ColunaEquipe[],
    linhasEquipe: LinhaEquipe[],
    rodape: { rotulo: string; total: string },
  ) {
    autoTable(doc, {
      ...estiloTabela(7.5, 1.8),
      startY,
      head: [colunasEquipe.map((c) => c.titulo)],
      body: linhasEquipe.map(({ item, total }) => colunasEquipe.map((col) => col.valor(item, total))),
      foot: [
        [{ content: rodape.rotulo, colSpan: colunasEquipe.length - 1, styles: { halign: 'right' } }, rodape.total],
      ],
      columnStyles: Object.fromEntries(
        colunasEquipe.map((c, i) => [i, { halign: c.halign, cellWidth: c.largura ?? 'auto', ...c.estilo }]),
      ),
      didParseCell: (data: CellHookData) => {
        // Cabeçalho e rodapé seguem o alinhamento da coluna.
        if (data.section === 'head') data.cell.styles.halign = colunasEquipe[data.column.index].halign ?? 'left';
        if (data.section === 'foot') data.cell.styles.halign = 'right';
      },
    });
  }

  const colunaColaborador: ColunaEquipe = {
    titulo: 'Colaborador',
    estilo: { textColor: N900, fontStyle: 'bold' },
    valor: (i) => i.colaboradorNome,
  };
  const colunaFuncao: ColunaEquipe = { titulo: 'Função', valor: (i) => i.funcaoNome };
  const colunaPrecoNormal: ColunaEquipe = { titulo: 'Preço normal', halign: 'right', valor: formatPrecoNormal };
  const colunaTotal: ColunaEquipe = {
    titulo: 'Total',
    halign: 'right',
    estilo: { textColor: N900, fontStyle: 'bold' },
    valor: (_i, total) => total,
  };

  if (dias.length === 1) {
    // Um só dia: o período aparece em cada linha.
    tabelaEquipe(
      y,
      [
        colunaColaborador,
        colunaFuncao,
        { titulo: 'Entrada', halign: 'center', valor: () => dataHoraColuna(primeiro.data, primeiro.entrada) },
        { titulo: 'Saída', halign: 'center', valor: () => dataHoraColuna(primeiro.dataSaida, primeiro.saida) },
        colunaPrecoNormal,
        colunaTotal,
      ],
      relatorio.itens.map((item, n) => ({ item, total: calc.itens[n] ? formatCent(calc.itens[n].totalCent) : '-' })),
      { rotulo: 'Subtotal da equipe', total: formatCent(calc.subtotalColaboradoresCent) },
    );
  } else {
    // Vários dias: um bloco por dia, só com quem trabalhou nele. As larguras são
    // fixas para as colunas ficarem alinhadas de um bloco para o outro.
    dias.forEach((dia, n) => {
      const colunasDia: ColunaEquipe[] = [
        colunaColaborador,
        { ...colunaFuncao, largura: 36 },
        { titulo: 'Entrada', halign: 'center', largura: 31, valor: () => dataHoraColuna(dia.data, dia.entrada) },
        { titulo: 'Saída', halign: 'center', largura: 31, valor: () => dataHoraColuna(dia.dataSaida, dia.saida) },
        { ...colunaPrecoNormal, largura: 24 },
        { ...colunaTotal, largura: 24 },
      ];
      const linhasDia: LinhaEquipe[] = [];
      let subtotalDiaCent = 0;
      relatorio.itens.forEach((item, i) => {
        const doDia = calc.itens[i]?.porDia.find((p) => p.dia === n);
        if (!doDia) return;
        subtotalDiaCent += doDia.totalCent;
        linhasDia.push({ item, total: formatCent(doDia.totalCent) });
      });

      y = novaPaginaSePreciso(doc, n === 0 ? y : finalY(doc) + 8, 55);
      texto(doc, N900, 9, 'bold');
      const rotuloDia = `Dia ${n + 1}`;
      doc.text(rotuloDia, MARGEM, y + 2);
      const larguraRotulo = doc.getTextWidth(rotuloDia);
      texto(doc, N500, 8);
      doc.text(formatPeriodo(dia), MARGEM + larguraRotulo + 3, y + 2);
      tabelaEquipe(y + 4, colunasDia, linhasDia, { rotulo: `Subtotal do dia ${n + 1}`, total: formatCent(subtotalDiaCent) });
    });

    // Fecha a seção com o total de todos os dias.
    autoTable(doc, {
      ...estiloTabela(7.5, 1.8),
      startY: finalY(doc) + 3,
      body: [
        [
          { content: 'Subtotal da equipe', styles: { halign: 'right' } },
          { content: formatCent(calc.subtotalColaboradoresCent), styles: { halign: 'right' } },
        ],
      ],
      columnStyles: { 1: { cellWidth: 24 } },
      bodyStyles: { fillColor: N100, textColor: N900, fontStyle: 'bold', lineWidth: 0 },
    });
  }

  // ---------- Material ----------
  if (calc.materialCent > 0) {
    y = novaPaginaSePreciso(doc, finalY(doc) + 10, 40);
    y = tituloSecao(doc, 'Material', y);
    autoTable(doc, {
      ...estiloTabela(9, 2.2),
      startY: y,
      head: [['Item', 'Total']],
      body: [['Material', formatCent(calc.materialCent)]],
      columnStyles: { 0: { textColor: N900 }, 1: { halign: 'right', textColor: N900, fontStyle: 'bold' } },
      didParseCell: (data: CellHookData) => {
        if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
      },
    });
  }

  // ---------- Alimentação: separada do valor de cada colaborador ----------
  const { alimentacao } = calc;
  if (alimentacao.manual && alimentacao.totalCent > 0) {
    // Valor informado à mão (ex.: nota fiscal): sem detalhe de refeições.
    y = novaPaginaSePreciso(doc, finalY(doc) + 10, 40);
    y = tituloSecao(doc, 'Alimentação', y);
    autoTable(doc, {
      ...estiloTabela(9, 2.2),
      startY: y,
      head: [['Item', 'Total']],
      body: [['Alimentação', formatCent(alimentacao.totalCent)]],
      columnStyles: { 0: { textColor: N900 }, 1: { halign: 'right', textColor: N900, fontStyle: 'bold' } },
      didParseCell: (data: CellHookData) => {
        if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
      },
    });
  } else if (alimentacao.totalCent > 0) {
    y = novaPaginaSePreciso(doc, finalY(doc) + 10, 50);
    y = tituloSecao(doc, 'Alimentação', y);
    const porDia = dias.length > 1;
    // Com vários dias cada refeição sai por dia (data na primeira linha do dia).
    const linhasRefeicao: (string | { content: string; rowSpan: number; styles?: object })[][] = [];
    const refeicoesDe = (a: { almocos: number; jantares: number; almocoCent: number; jantarCent: number }) => {
      const r: string[][] = [];
      if (a.almocos > 0) r.push(['Almoço', String(a.almocos), formatReais(alimentacao.precoAlmoco), formatCent(a.almocoCent)]);
      if (a.jantares > 0) r.push(['Jantar', String(a.jantares), formatReais(alimentacao.precoJantar), formatCent(a.jantarCent)]);
      return r;
    };
    if (porDia) {
      alimentacao.porDia.forEach((a, n) => {
        const refeicoes = refeicoesDe(a);
        refeicoes.forEach((r, k) => {
          linhasRefeicao.push(
            k === 0
              ? [{ content: formatDataISO(dias[n].data), rowSpan: refeicoes.length, styles: { valign: 'top' } }, ...r]
              : r,
          );
        });
      });
    } else {
      linhasRefeicao.push(...refeicoesDe(alimentacao));
    }
    const deslocamento = porDia ? 1 : 0;
    autoTable(doc, {
      ...estiloTabela(9, 2.2),
      startY: y,
      head: [[...(porDia ? ['Dia'] : []), 'Refeição', 'Quantidade', 'Preço', 'Total']],
      body: linhasRefeicao,
      foot: [
        [
          { content: 'Subtotal de alimentação', colSpan: 3 + deslocamento, styles: { halign: 'right' } },
          formatCent(alimentacao.totalCent),
        ],
      ],
      columnStyles: {
        0: { textColor: N900 },
        [deslocamento]: { textColor: N900 },
        [1 + deslocamento]: { halign: 'right' },
        [2 + deslocamento]: { halign: 'right' },
        [3 + deslocamento]: { halign: 'right', textColor: N900, fontStyle: 'bold' },
      },
      didParseCell: (data: CellHookData) => {
        const coluna = data.column.index - deslocamento;
        if ((data.section === 'head' && coluna > 0) || data.section === 'foot') data.cell.styles.halign = 'right';
      },
    });
  }

  // ---------- Quilometragem e deslocamento ----------
  const { comum, tecnico, viagens } = calc.deslocamento;
  y = novaPaginaSePreciso(doc, finalY(doc) + 10, 60);
  y = tituloSecao(doc, 'Quilometragem e deslocamento', y);
  const linhas: string[][] = [
    [
      'Quilometragem',
      `${formatNumero(calc.km.quantidade)} km`,
      `${formatReais(calc.km.preco)}/km`,
      formatCent(calc.km.totalCent),
    ],
  ];
  // Uma linha por viagem, grupo (comum/técnico) e faixa (normal/100%) com horas.
  for (const viagem of viagens) {
    const titulo = viagem.dia ? `${viagem.rotulo} (${formatPeriodo(viagem.dia)})` : viagem.rotulo;
    for (const [nome, grupo, cent] of [
      ['comum', comum, viagem.comumCent],
      ['técnico', tecnico, viagem.tecnicoCent],
    ] as const) {
      if (grupo.colaboradores === 0) continue;
      const faixas = [
        { rotulo: 'hora normal', min: viagem.normalMin, preco: grupo.precoHora },
        { rotulo: 'hora 100%', min: viagem.cemMin, preco: grupo.precoHora * MULTIPLICADOR_CEM },
      ].filter((f) => f.min > 0);
      // O total da viagem é arredondado por faixa em `calcularRelatorio`; aqui a mesma conta, por linha.
      const totais = faixas.map((f) => grupo.colaboradores * Math.round((toCent(f.preco) * f.min) / 60));
      const somaLinhas = totais.reduce((a, b) => a + b, 0);
      faixas.forEach((f, i) => {
        linhas.push([
          `${titulo}\nDeslocamento ${nome} · ${grupo.colaboradores} ${grupo.colaboradores === 1 ? 'colaborador' : 'colaboradores'} · ${f.rotulo}`,
          `${hmHoras(grupo.colaboradores * f.min)} h`,
          `${formatReais(f.preco)}/h`,
          formatCent(i === faixas.length - 1 ? totais[i] + (cent - somaLinhas) : totais[i]),
        ]);
      });
    }
  }

  autoTable(doc, {
    ...estiloTabela(9, 2.2),
    startY: y,
    head: [['Item', 'Quantidade', 'Preço', 'Total']],
    body: linhas,
    foot: [
      [
        { content: 'Subtotal de deslocamento', colSpan: 3, styles: { halign: 'right' } },
        formatCent(calc.km.totalCent + calc.deslocamento.totalCent),
      ],
    ],
    columnStyles: {
      0: { textColor: N900 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', textColor: N900, fontStyle: 'bold' },
    },
    didParseCell: (data: CellHookData) => {
      if ((data.section === 'head' && data.column.index > 0) || data.section === 'foot') data.cell.styles.halign = 'right';
    },
  });

  // ---------- Total geral: bloco neutro ----------
  y = novaPaginaSePreciso(doc, finalY(doc) + 8, 30);
  const larguraTotal = 82;
  const xTotal = largura - MARGEM - larguraTotal;
  doc.setFillColor(...N50);
  doc.setDrawColor(...N300);
  doc.setLineWidth(0.3);
  doc.roundedRect(xTotal, y, larguraTotal, 17, RAIO + 1, RAIO + 1, 'FD');
  texto(doc, N500, 8);
  doc.text('Total do relatório', xTotal + 5, y + 6.5);
  texto(doc, N900, 16, 'bold');
  doc.text(formatCent(calc.totalCent), largura - MARGEM - 5, y + 12.5, { align: 'right' });

  // ---------- Rodapé em todas as páginas ----------
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...N200);
    doc.setLineWidth(0.2);
    doc.line(MARGEM, altura - 12, largura - MARGEM, altura - 12);
    texto(doc, N400, 7);
    doc.text(EMPRESA.razaoSocial, MARGEM, altura - 8);
    doc.text(`Página ${p} de ${paginas}`, largura - MARGEM, altura - 8, { align: 'right' });
  }

  return doc.output('blob');
}

export async function baixarRelatorioPdf(relatorio: RelatorioDTO) {
  const blob = await gerarRelatorioPdf(relatorio);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-${relatorio.id ?? 'previa'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
