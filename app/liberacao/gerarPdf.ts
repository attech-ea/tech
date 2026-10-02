import { jsPDF } from 'jspdf';
import { formatDataISO } from '../relatorio/calculo';
import { assuntoLiberacao, MODELO } from './modelo';
import type { LiberacaoDTO } from './tipos';

type Cor = [number, number, number];

// Cores do modelo do e-mail (Outlook): texto preto, links em vermelho, divisórias cinza.
const PRETO: Cor = [0, 0, 0];
const CINZA: Cor = [130, 130, 130];
const VERMELHO: Cor = [196, 49, 42];
const OUTLOOK: Cor = [15, 108, 189];

const MARGEM = 19;
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

async function carregarLogo(): Promise<string | null> {
  try {
    const res = await fetch(MODELO.logoUrl);
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

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function saudacao(agora: Date): string {
  const h = agora.getHours();
  return h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite';
}

function fonte(doc: jsPDF, familia: 'helvetica' | 'times', estilo: 'normal' | 'bold' | 'italic', tamanho: number, cor = PRETO) {
  doc.setFont(familia, estilo);
  doc.setFontSize(tamanho);
  doc.setTextColor(...cor);
}

// Texto com sublinhado; devolve a largura ocupada.
function textoSublinhado(doc: jsPDF, txt: string, x: number, y: number, cor: Cor): number {
  doc.setTextColor(...cor);
  doc.text(txt, x, y);
  const w = doc.getTextWidth(txt);
  doc.setDrawColor(...cor);
  doc.setLineWidth(0.2);
  doc.line(x, y + 0.8, x + w, y + 0.8);
  return w;
}

export function nomeArquivoLiberacao(data: string): string {
  return `solicitacao-liberacao-${data}.pdf`;
}

// Reproduz o e-mail de liberação (modelo em PDF do Outlook) com o destinatário e a equipe do dia.
export async function gerarLiberacaoPdf(liberacao: LiberacaoDTO, agora = new Date()): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const direita = largura - MARGEM;
  const logo = await carregarLogo();

  // ---------- Cabeçalho ----------
  doc.setFillColor(...OUTLOOK);
  doc.roundedRect(MARGEM, 15, 7, 7, 1.5, 1.5, 'F');
  fonte(doc, 'helvetica', 'bold', 10, [255, 255, 255]);
  doc.text('O', MARGEM + 3.5, 20, { align: 'center' });
  fonte(doc, 'helvetica', 'normal', 12);
  doc.text('Outlook', MARGEM + 10, 20.3);

  doc.setDrawColor(...CINZA);
  doc.setLineWidth(0.25);
  doc.line(MARGEM, 27, direita, 27);
  fonte(doc, 'helvetica', 'bold', 11);
  doc.text(assuntoLiberacao(liberacao.embarcacao), MARGEM, 33);
  doc.line(MARGEM, 37, direita, 37);

  const dataEnvio = `${DIAS_SEMANA[agora.getDay()]}, ${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())} ${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
  const remetente = `${MODELO.de.email} <${MODELO.de.email}>`;
  const linhas: [string, string][] = [
    ['De', remetente],
    ['Data', dataEnvio],
    ['Para', `${liberacao.destinatario.nome} <${liberacao.destinatario.email}>`],
    ['Cc', `${MODELO.cc} <${MODELO.cc}>`],
  ];
  let y = 45;
  for (const [rotulo, valor] of linhas) {
    fonte(doc, 'helvetica', 'bold', 9);
    doc.text(rotulo, MARGEM + 1, y);
    fonte(doc, 'helvetica', 'normal', 9);
    doc.text(valor, MARGEM + 14, y);
    y += 5.6;
  }

  // ---------- Corpo ----------
  y += 12;
  fonte(doc, 'helvetica', 'normal', 10.5);
  doc.text(`Prezados, ${saudacao(agora)}.`, MARGEM, y);

  y += 5.2;
  fonte(doc, 'times', 'normal', 11.5);
  const paragrafo = doc.splitTextToSize(
    `Venho, por meio deste, solicitar a liberação de acesso dos colaboradores abaixo relacionados, representantes da Attech, para a embarcação ${liberacao.embarcacao}, no dia ${formatDataISO(liberacao.data)}.`,
    largura - 2 * MARGEM - 30,
  ) as string[];
  doc.text(paragrafo, MARGEM, y, { lineHeightFactor: 1.3 });
  y += paragrafo.length * 5.3 + 6;

  for (const p of liberacao.equipe) {
    if (y > altura - 45) {
      doc.addPage();
      y = 22;
    }
    fonte(doc, 'helvetica', 'bold', 10.5);
    doc.text(p.nome.toLocaleUpperCase('pt-BR'), MARGEM + 1, y);
    fonte(doc, 'helvetica', 'normal', 10.5);
    doc.text(
      [`RG: ${p.rg}`, `CPF: ${p.cpf}`, formatDataISO(p.dataNascimento)],
      MARGEM,
      y + 5,
      { lineHeightFactor: 1.35 },
    );
    y += 27;
  }

  // ---------- Fecho e assinatura ----------
  if (y > altura - 75) {
    doc.addPage();
    y = 22;
  }
  y += 2;
  fonte(doc, 'helvetica', 'italic', 10.5, VERMELHO);
  textoSublinhado(doc, 'Por gentileza, acusar o recebimento do e-mail.', MARGEM, y, VERMELHO);
  y += 5.2;
  fonte(doc, 'helvetica', 'normal', 10.5);
  doc.text('Atenciosamente.', MARGEM, y);

  y += 8;
  const larguraLogo = 24;
  let alturaLogo = 34;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      alturaLogo = (props.height / props.width) * larguraLogo;
      doc.addImage(logo, props.fileType, MARGEM + 2, y, larguraLogo, alturaLogo, 'logo', 'FAST');
    } catch {
      // Sem o logo, a assinatura sai só com o texto.
    }
  }
  const xTexto = MARGEM + larguraLogo + 12;
  doc.setDrawColor(...PRETO);
  doc.setLineWidth(0.35);
  doc.line(xTexto - 4, y, xTexto - 4, y + alturaLogo);

  fonte(doc, 'helvetica', 'normal', 11);
  textoSublinhado(doc, MODELO.de.nome, xTexto, y + 4, PRETO);
  textoSublinhado(doc, MODELO.assinatura.setor, xTexto, y + 11, PRETO);

  const contatos: [string, string][] = [
    ['Email: ', MODELO.de.email],
    ['Contato: ', MODELO.assinatura.contato],
    ['Site: ', MODELO.assinatura.site],
  ];
  contatos.forEach(([rotulo, valor], i) => {
    const yl = y + 18 + i * 4.6;
    fonte(doc, 'helvetica', 'normal', 10);
    doc.text(rotulo, xTexto, yl);
    textoSublinhado(doc, valor, xTexto + doc.getTextWidth(rotulo), yl, VERMELHO);
  });

  return doc.output('blob');
}

export async function baixarLiberacaoPdf(liberacao: LiberacaoDTO) {
  const blob = await gerarLiberacaoPdf(liberacao);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivoLiberacao(liberacao.data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
