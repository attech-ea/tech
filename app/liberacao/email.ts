import { formatDataISO } from '../relatorio/calculo';
import { MODELO } from './modelo';
import type { LiberacaoDTO } from './tipos';

// Identificador do logo embutido no e-mail (anexo inline).
export const LOGO_CID = 'logo-attech';

const VERMELHO = '#c4312a';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Servidores rodam em UTC; a saudação segue o horário de Brasília.
export function saudacao(agora = new Date()): string {
  const h = Number(
    new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(agora),
  );
  return h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite';
}

function paragrafo(l: LiberacaoDTO): string {
  return `Venho, por meio deste, solicitar a liberação de acesso dos colaboradores abaixo relacionados, representantes da Attech, para a embarcação ${l.embarcacao}, no dia ${formatDataISO(l.data)}.`;
}

// Mesmo conteúdo do PDF: saudação, pedido, equipe, fecho e assinatura.
export function corpoHtml(l: LiberacaoDTO, agora = new Date()): string {
  const equipe = l.equipe
    .map(
      (p) => `<p style="margin:0 0 16px">
<strong>${esc(p.nome.toLocaleUpperCase('pt-BR'))}</strong><br>
RG: ${esc(p.rg)}<br>
CPF: ${esc(p.cpf)}<br>
${esc(formatDataISO(p.dataNascimento))}
</p>`,
    )
    .join('\n');

  const link = (txt: string, href?: string) =>
    `<a ${href ? `href="${esc(href)}" ` : ''}style="color:${VERMELHO};text-decoration:underline">${esc(txt)}</a>`;

  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#000;line-height:1.4">
<p style="margin:0 0 12px">Prezados, ${saudacao(agora)}.</p>
<p style="margin:0 0 16px;font-family:'Times New Roman',serif;font-size:15px">${esc(paragrafo(l))}</p>
${equipe}
<p style="margin:0 0 4px;color:${VERMELHO}"><em><u>Por gentileza, acusar o recebimento do e-mail.</u></em></p>
<p style="margin:0 0 16px">Atenciosamente.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td style="padding-right:14px;border-right:1px solid #000;vertical-align:middle"><img src="cid:${LOGO_CID}" alt="Attech" width="96" style="display:block"></td>
<td style="padding-left:14px;vertical-align:middle;font-size:14px">
<u>${esc(MODELO.de.nome)}</u><br>
<u>${esc(MODELO.assinatura.setor)}</u><br><br>
<span style="font-size:13px">Email: ${link(MODELO.de.email, `mailto:${MODELO.de.email}`)}<br>
Contato: ${link(MODELO.assinatura.contato)}<br>
Site: ${link(MODELO.assinatura.site, `https://${MODELO.assinatura.site}`)}</span>
</td></tr></table>
</div>`;
}

// Versão em texto puro, para clientes que não exibem HTML.
export function corpoTexto(l: LiberacaoDTO, agora = new Date()): string {
  const equipe = l.equipe
    .map((p) => [p.nome.toLocaleUpperCase('pt-BR'), `RG: ${p.rg}`, `CPF: ${p.cpf}`, formatDataISO(p.dataNascimento)].join('\n'))
    .join('\n\n');
  return [
    `Prezados, ${saudacao(agora)}.`,
    paragrafo(l),
    equipe,
    'Por gentileza, acusar o recebimento do e-mail.',
    'Atenciosamente.',
    [
      MODELO.de.nome,
      MODELO.assinatura.setor,
      `Email: ${MODELO.de.email}`,
      `Contato: ${MODELO.assinatura.contato}`,
      `Site: ${MODELO.assinatura.site}`,
    ].join('\n'),
  ].join('\n\n');
}
