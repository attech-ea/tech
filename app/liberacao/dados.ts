import { prisma } from '@/lib/prisma';
import type { DestinatarioDTO } from './tipos';

export async function listarDestinatarios(): Promise<DestinatarioDTO[]> {
  const destinatarios = await prisma.destinatario.findMany({ orderBy: { nome: 'asc' } });
  return destinatarios.map((d) => ({ id: d.id, nome: d.nome, email: d.email }));
}
