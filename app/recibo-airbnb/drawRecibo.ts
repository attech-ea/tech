import {
  type ReciboData,
  addDaysISO,
  computePricing,
  formatIdDate,
  formatMoneyBRL,
  formatPaymentDate,
  formatRangeDate,
  plural,
} from './reciboData';

const INK = '#1e1e1e';
const MUTED = '#6b6b6b';
const LINK = '#1b6fb0';
const BORDER = '#dcdcd4';
const CORAL = '#ff5a5f';

const SANS = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

interface Segment {
  text: string;
  color?: string;
  bold?: boolean;
  href?: string;
}

export interface ReciboLink {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const LINKS = {
  itinerario: 'https://www.airbnb.com.br/trips',
  anuncio: 'https://www.airbnb.com.br/s/homes',
  pagamentos: 'https://www.airbnb.com.br/users/payments',
  ajuda: 'https://www.airbnb.com.br/help',
  saibaMais: 'https://www.airbnb.com.br/help',
  site: 'https://www.airbnb.com.br',
};

function font(px: number, bold: boolean): string {
  return `${bold ? '700' : '400'} ${px}px ${SANS}`;
}

function line(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, px: number, opts: { bold?: boolean; color?: string; align?: CanvasTextAlign } = {}): number {
  ctx.font = font(px, !!opts.bold);
  ctx.fillStyle = opts.color || INK;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  return y + px * 1.35;
}

function kv(ctx: CanvasRenderingContext2D, xLeft: number, xRight: number, y: number, label: string, value: string, px: number, opts: { bold?: boolean } = {}): number {
  ctx.font = font(px, !!opts.bold);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(label, xLeft, y);
  ctx.textAlign = 'right';
  ctx.fillText(value, xRight, y);
  return y + px * 1.5;
}

function hr(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color = BORDER): number {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  return y + 18;
}

function wrapRich(ctx: CanvasRenderingContext2D, x: number, y: number, maxWidth: number, segments: Segment[], px: number, lineHeight: number, linksOut?: ReciboLink[]): number {
  ctx.textBaseline = 'top';
  const words: { text: string; color: string; bold: boolean; href?: string }[] = [];
  segments.forEach((seg) => {
    seg.text.split(' ').forEach((w) => {
      if (w) words.push({ text: w, color: seg.color || MUTED, bold: !!seg.bold, href: seg.href });
    });
  });

  let cursorX = x;
  let cursorY = y;
  const spaceWidth = (bold: boolean) => {
    ctx.font = font(px, bold);
    return ctx.measureText(' ').width;
  };

  const rawLinks: ReciboLink[] = [];

  words.forEach((word, i) => {
    ctx.font = font(px, word.bold);
    const w = ctx.measureText(word.text).width;
    if (cursorX !== x && cursorX + w > x + maxWidth) {
      cursorX = x;
      cursorY += lineHeight;
    }
    ctx.fillStyle = word.color;
    ctx.textAlign = 'left';
    ctx.fillText(word.text, cursorX, cursorY);
    if (word.href) {
      rawLinks.push({ href: word.href, x: cursorX, y: cursorY, w, h: px });
    }
    cursorX += w + spaceWidth(word.bold);
  });

  if (linksOut) {
    rawLinks.forEach((link) => {
      const last = linksOut[linksOut.length - 1];
      if (last && last.href === link.href && last.y === link.y) {
        last.w = link.x + link.w - last.x;
      } else {
        linksOut.push({ ...link });
      }
    });
  }

  return cursorY + lineHeight;
}

function drawBeloIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
  const petal = r * 0.62;
  const offset = r * 0.42;
  [
    [0, -offset],
    [offset, 0],
    [0, offset],
    [-offset, 0],
  ].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + dy, petal * (dx === 0 ? 0.62 : 1), petal * (dy === 0 ? 0.62 : 1), 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoundedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + size, y, x + size, y + size, radius);
  ctx.arcTo(x + size, y + size, x, y + size, radius);
  ctx.arcTo(x, y + size, x, y, radius);
  ctx.arcTo(x, y, x + size, y, radius);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const sw = size / scale;
  const sh = size / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size);
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, rightX: number, centerY: number, height: number) {
  const width = (img.naturalWidth / img.naturalHeight) * height;
  ctx.drawImage(img, rightX - width, centerY - height / 2, width, height);
}

function drawPhotoPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = 10;
  ctx.save();
  ctx.fillStyle = '#eef1f4';
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + size, y, x + size, y + size, r);
  ctx.arcTo(x + size, y + size, x, y + size, r);
  ctx.arcTo(x, y + size, x, y, r);
  ctx.arcTo(x, y, x + size, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#aab2bd';
  ctx.beginPath();
  ctx.arc(x + size * 0.36, y + size * 0.38, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.14, y + size * 0.78);
  ctx.lineTo(x + size * 0.4, y + size * 0.52);
  ctx.lineTo(x + size * 0.58, y + size * 0.68);
  ctx.lineTo(x + size * 0.76, y + size * 0.48);
  ctx.lineTo(x + size * 0.9, y + size * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface ReciboImages {
  logo: HTMLImageElement | null;
  quarto: HTMLImageElement | null;
}

export function drawRecibo(ctx: CanvasRenderingContext2D, data: ReciboData, W: number, H: number, images: ReciboImages = { logo: null, quarto: null }): ReciboLink[] {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const links: ReciboLink[] = [];
  const margin = 75;
  const contentW = W - margin * 2;
  const checkoutISO = addDaysISO(data.checkinISO, data.noites);
  const pricing = computePricing(data.valorTotal, data.noites);

  // Header
  let y = 88;
  line(ctx, margin, y, 'Seu recibo do Airbnb', 40, { bold: true });
  if (images.logo && images.logo.naturalWidth > 0) {
    drawLogo(ctx, images.logo, W - margin, y + 24, 56);
  } else {
    drawBeloIcon(ctx, W - margin - 150, y + 22, 26, CORAL);
    line(ctx, W - margin, y + 4, 'airbnb', 34, { bold: true, color: CORAL, align: 'right' });
  }
  y += 74;

  line(ctx, margin, y, `Identificação do recibo: ${data.idCode}    ${formatIdDate(data.checkinISO)}`, 20, { color: MUTED });
  y += 56;

  const colGap = 40;
  const leftW = Math.round(contentW * 0.585);
  const rightW = contentW - leftW - colGap;
  const leftX = margin;
  const rightX = margin + leftW + colGap;
  const boxPad = 28;
  const colTop = y;

  // Left box
  let ly = colTop + boxPad;
  ly = line(ctx, leftX + boxPad, ly, data.cidade, 26, { bold: true });
  ly = line(ctx, leftX + boxPad, ly, `${data.noites} ${plural(data.noites, 'noite', 'noites')} em ${data.cidade}`, 17, { bold: true, color: '#3a3a3a' });
  ly += 6;
  ly = hr(ctx, leftX + boxPad, leftX + leftW - boxPad, ly);
  ly += 4;

  const photoSize = 76;
  const rowStartY = ly;
  const photoX = leftX + leftW - boxPad - photoSize;
  const photoY = rowStartY - 4;
  if (images.quarto && images.quarto.naturalWidth > 0) {
    drawRoundedImage(ctx, images.quarto, photoX, photoY, photoSize, 10);
  } else {
    drawPhotoPlaceholder(ctx, photoX, photoY, photoSize);
  }
  const rangeTextMaxW = leftW - boxPad * 2 - photoSize - 20;
  const rangeLine = `${formatRangeDate(data.checkinISO)}  →  ${formatRangeDate(checkoutISO)}.`;
  const rangeTextBottom = wrapRich(ctx, leftX + boxPad, rowStartY, rangeTextMaxW, [{ text: rangeLine, color: INK }], 17, 24);
  ly = Math.max(rangeTextBottom, rowStartY - 4 + photoSize) + 10;

  ly = line(ctx, leftX + boxPad, ly, `Casa/apto inteiro · ${data.hospedes} ${plural(data.hospedes, 'cama', 'camas')} · ${data.hospedes} ${plural(data.hospedes, 'hóspede', 'hóspedes')}`, 16, { color: '#3a3a3a' });
  ly = line(ctx, leftX + boxPad, ly, `Hospedado por ${data.anfitriao}`, 16, { color: '#3a3a3a' });
  ly = line(ctx, leftX + boxPad, ly, `Código de confirmação: ${data.confirmCode}`, 16, { color: '#3a3a3a' });
  ly += 4;
  ly = wrapRich(ctx, leftX + boxPad, ly, leftW - boxPad * 2, [
    { text: 'Acesse o itinerário', color: LINK, bold: true, href: LINKS.itinerario },
    { text: '·', color: MUTED },
    { text: 'Acesse o anúncio', color: LINK, bold: true, href: LINKS.anuncio },
  ], 15, 20, links);
  ly += 8;
  ly = hr(ctx, leftX + boxPad, leftX + leftW - boxPad, ly);
  ly += 4;

  ly = line(ctx, leftX + boxPad, ly, `Viajante: ${data.viajante}`, 15, { color: '#3a3a3a' });
  ly += 6;
  ly = line(ctx, leftX + boxPad, ly, 'Política de cancelamento', 17, { bold: true });
  ly = wrapRich(ctx, leftX + boxPad, ly, leftW - boxPad * 2, [{ text: 'Esta reserva não é reembolsável.', color: MUTED }], 14, 20);
  ly = wrapRich(ctx, leftX + boxPad, ly, leftW - boxPad * 2, [{ text: 'Os horários-limite para reserva são baseados no horário local da acomodação.', color: MUTED }], 14, 20);

  const leftBoxBottom = ly + boxPad - 10;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(leftX, colTop, leftW, leftBoxBottom - colTop);

  // Right boxes: Detalhamento do preço
  let ry = colTop + boxPad;
  ry = line(ctx, rightX + boxPad, ry, 'Detalhamento do preço', 21, { bold: true });
  ry += 6;
  ry = kv(ctx, rightX + boxPad, rightX + rightW - boxPad, ry, `${formatMoneyBRL(pricing.perNoite)} x ${data.noites} ${plural(data.noites, 'noite', 'noites')}`, formatMoneyBRL(pricing.subtotal), 16);
  ry += 4;
  ry = hr(ctx, rightX + boxPad, rightX + rightW - boxPad, ry);
  ry = kv(ctx, rightX + boxPad, rightX + rightW - boxPad, ry, 'Taxa de serviço', formatMoneyBRL(pricing.taxaServico), 16);
  ry = kv(ctx, rightX + boxPad, rightX + rightW - boxPad, ry, 'Impostos', formatMoneyBRL(pricing.impostos), 16);
  ry += 4;
  ry = hr(ctx, rightX + boxPad, rightX + rightW - boxPad, ry, '#b8b8b0');
  ry = kv(ctx, rightX + boxPad, rightX + rightW - boxPad, ry, 'Total (BRL)', formatMoneyBRL(pricing.total), 18, { bold: true });

  const priceBoxBottom = ry + boxPad - 14;
  ctx.strokeStyle = BORDER;
  ctx.strokeRect(rightX, colTop, rightW, priceBoxBottom - colTop);

  // Right box: Pagamento
  let py = priceBoxBottom + 26;
  const paymentBoxTop = py;
  py += boxPad;
  py = line(ctx, rightX + boxPad, py, 'Pagamento', 21, { bold: true });
  py += 10;
  py = kv(ctx, rightX + boxPad, rightX + rightW - boxPad, py, 'PIX', formatMoneyBRL(pricing.total), 16);
  py = line(ctx, rightX + boxPad, py - 8, formatPaymentDate(data.checkinISO, data.horaPagamento), 13, { color: MUTED });
  py += 8;
  py = hr(ctx, rightX + boxPad, rightX + rightW - boxPad, py);
  py = kv(ctx, rightX + boxPad, rightX + rightW - boxPad, py, 'Valor pago (BRL)', formatMoneyBRL(pricing.total), 18, { bold: true });

  const paymentBoxBottom = py + boxPad - 14;
  ctx.strokeStyle = BORDER;
  ctx.strokeRect(rightX, paymentBoxTop, rightW, paymentBoxBottom - paymentBoxTop);

  // Dúvidas (below left column, aligned with whichever column is taller)
  let dy = leftBoxBottom + 34;
  dy = line(ctx, leftX, dy, 'Dúvidas?', 18, { bold: true });
  dy += 4;
  dy = wrapRich(ctx, leftX, dy, leftW, [
    { text: 'Encontre as informações de pagamentos e reembolsos em', color: MUTED },
    { text: 'seus pagamentos', color: LINK, bold: true, href: LINKS.pagamentos },
    { text: 'ou acesse a', color: MUTED },
    { text: 'Central de Ajuda.', color: LINK, bold: true, href: LINKS.ajuda },
  ], 16, 23, links);

  y = Math.max(dy, paymentBoxBottom) + 40;

  // Footer
  y = hr(ctx, margin, W - margin, y, '#c9c9c0') + 10;

  y = line(ctx, margin, y, 'Sobre este recibo', 17, { bold: true });
  y += 2;
  y = wrapRich(ctx, margin, y, contentW, [
    {
      text: 'Este resumo inclui informações do pagamento, taxas de serviço do Airbnb e impostos da sua reserva. Ele não serve para a declaração de impostos. Após a conclusão da viagem, é emitida uma nota fiscal de acordo com a autorização de regime especial — SEI nº 6017.2021/0025032-5.',
      color: MUTED,
    },
    { text: 'Saiba mais', color: LINK, bold: true, href: LINKS.saibaMais },
  ], 14, 21, links);
  y += 18;

  y = line(ctx, margin, y, 'Airbnb Plataforma Digital Ltda.', 17, { bold: true });
  y += 2;
  y = wrapRich(ctx, margin, y, contentW, [
    {
      text: 'Airbnb Plataforma Digital Ltda. é um agente de cobranças de pagamentos limitado do anfitrião. Isso significa que, após o pagamento das taxas totais ao Airbnb Plataforma Digital Ltda., sua obrigação de pagar ao anfitrião está cumprida. Os pedidos de reembolso serão processados de acordo com: (i) a política de cancelamento do Anfitrião (disponível no Anúncio); ou (ii) os Termos da Política de Reembolso e Remarcação de Reserva, disponíveis em www.airbnb.com.br/terms.',
      color: MUTED,
    },
  ], 14, 21);
  y += 26;

  y = hr(ctx, margin, W - margin, y, '#c9c9c0') + 6;

  const footColW = contentW / 2 - 20;
  let f1 = y;
  f1 = line(ctx, margin, f1, 'Pagamento processado por:', 14, { bold: true });
  f1 += 2;
  ['Airbnb Plataforma Digital Ltda.', 'Rua Aspicuelta, 422, Conjunto 51', 'São Paulo - SP', '05433-010', 'Brasil'].forEach((t) => {
    f1 = line(ctx, margin, f1, t, 14, { color: MUTED });
  });

  const rightFootX = margin + footColW + 40;
  let f2 = y;
  f2 = line(ctx, rightFootX, f2, 'Airbnb Plataforma Digital Ltda.', 14, { bold: true });
  f2 += 2;
  f2 = line(ctx, rightFootX, f2, 'Rua Aspicuelta 422,', 14, { color: MUTED });
  f2 = line(ctx, rightFootX, f2, 'conjunto 51, CEP:05433-010, São Paulo - SP - Brazil', 14, { color: MUTED });
  f2 = wrapRich(ctx, rightFootX, f2, footColW, [{ text: 'www.airbnb.com.br', color: LINK, bold: true, href: LINKS.site }], 14, 20, links);

  if (images.logo && images.logo.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawLogo(ctx, images.logo, W - margin, f2 + 13, 26);
    ctx.restore();
  } else {
    drawBeloIcon(ctx, W - margin - 22, f2 + 14, 14, '#9aa0a8');
    line(ctx, W - margin, f2 + 4, 'airbnb', 18, { bold: true, color: '#9aa0a8', align: 'right' });
  }

  return links;
}
