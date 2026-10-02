import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { buscarRelatorio, listarColaboradores } from '../dados';
import RelatorioForm from '../RelatorioForm';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  const [relatorio, colaboradores] = await Promise.all([buscarRelatorio(numero), listarColaboradores()]);
  if (!relatorio) notFound();

  // `key` garante um formulário novo ao navegar de um relatório para outro.
  return <RelatorioForm key={relatorio.id} colaboradores={colaboradores} inicial={relatorio} />;
}
