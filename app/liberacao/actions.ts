'use server';

import nodemailer from 'nodemailer';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { limparEspacos } from '../relatorio/formatacao';
import type { ActionResult } from '../relatorio/tipos';
import { corpoHtml, corpoTexto, LOGO_CID } from './email';
import { assuntoLiberacao, MODELO } from './modelo';
import type { LiberacaoDTO } from './tipos';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mensagemErro(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return 'Já existe um destinatário com esse e-mail.';
  }
  console.error(e);
  return 'Erro ao salvar no banco de dados.';
}

export async function salvarDestinatario(input: {
  id: number | null;
  nome: string;
  email: string;
}): Promise<ActionResult> {
  const nome = limparEspacos(input.nome);
  const email = limparEspacos(input.email).toLowerCase();
  if (!nome) return { ok: false, error: 'Informe o nome do destinatário.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'E-mail inválido.' };

  try {
    if (input.id) await prisma.destinatario.update({ where: { id: input.id }, data: { nome, email } });
    else await prisma.destinatario.create({ data: { nome, email } });
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidatePath('/liberacao', 'layout');
  return { ok: true, data: undefined };
}

export async function excluirDestinatario(id: number): Promise<ActionResult> {
  try {
    await prisma.destinatario.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidatePath('/liberacao', 'layout');
  return { ok: true, data: undefined };
}

async function carregarLogo(): Promise<Buffer | null> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) return null;
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    const res = await fetch(`${proto}://${host}${MODELO.logoUrl}`);
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Monta a solicitação a partir do banco (nada do e-mail vem pronto do navegador) e a envia
// pela caixa da Vanessa via SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS).
export async function enviarLiberacao(input: {
  destinatarioId: number;
  embarcacao: string;
  data: string;
  colaboradorIds: number[];
}): Promise<ActionResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { ok: false, error: 'Envio de e-mail não configurado (SMTP_HOST, SMTP_USER e SMTP_PASS).' };
  }

  const embarcacao = limparEspacos(input.embarcacao);
  if (!embarcacao) return { ok: false, error: 'Informe a embarcação.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) return { ok: false, error: 'Informe o dia do acesso.' };

  const [destinatario, colaboradores] = await Promise.all([
    prisma.destinatario.findUnique({ where: { id: input.destinatarioId } }),
    prisma.colaborador.findMany({ where: { id: { in: input.colaboradorIds } }, orderBy: { nome: 'asc' } }),
  ]);
  if (!destinatario) return { ok: false, error: 'Destinatário não encontrado.' };
  if (colaboradores.length === 0) return { ok: false, error: 'Marque ao menos um colaborador.' };
  const incompletos = colaboradores.filter((c) => !c.rg || !c.cpf || !c.dataNascimento);
  if (incompletos.length > 0) {
    return {
      ok: false,
      error: `Complete o cadastro (RG, CPF e nascimento) de: ${incompletos.map((c) => c.nome).join(', ')}.`,
    };
  }

  const liberacao: LiberacaoDTO = {
    destinatario: { id: destinatario.id, nome: destinatario.nome, email: destinatario.email },
    embarcacao,
    data: input.data,
    equipe: colaboradores.map((c) => ({
      nome: c.nome,
      rg: c.rg!,
      cpf: c.cpf!,
      dataNascimento: c.dataNascimento!,
    })),
  };

  const logo = await carregarLogo();
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporte.sendMail({
      from: { name: MODELO.de.nome, address: MODELO.de.email },
      to: { name: destinatario.nome, address: destinatario.email },
      cc: MODELO.cc,
      subject: assuntoLiberacao(embarcacao),
      text: corpoTexto(liberacao),
      html: corpoHtml(liberacao),
      attachments: logo ? [{ filename: 'logo-attech.png', content: logo, cid: LOGO_CID }] : [],
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Não foi possível enviar o e-mail. Confira as credenciais do SMTP.' };
  }
  return { ok: true, data: undefined };
}
