import { connection } from 'next/server';
import { listarUsuarios } from '../relatorio/dados';
import { listarDestinatarios } from './dados';
import Liberacao from './Liberacao';

export default async function Page() {
  await connection();
  const [destinatarios, usuarios] = await Promise.all([listarDestinatarios(), listarUsuarios()]);
  return <Liberacao destinatarios={destinatarios} usuarios={usuarios} />;
}
