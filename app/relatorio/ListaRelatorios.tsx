'use client';

import {
  CalendarBlankIcon,
  CaretRightIcon,
  FilePdfIcon,
  FilesIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  UsersIcon,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { useState } from 'react';
import { fs } from '@/lib/calc-clamp';
import { carregarRelatorio, excluirRelatorio } from './actions';
import { formatDataISO, formatReais } from './calculo';
import { baixarRelatorioPdf } from './gerarPdf';
import type { RelatorioResumoDTO } from './tipos';
import { Alerta, btnIcone, btnIconePerigo, btnPrimario, Card, ConfirmarExclusao, SectionHead } from './ui';

const GRID = 'grid grid-cols-[3rem_minmax(0,1fr)_auto] md:grid-cols-[3.5rem_7rem_minmax(0,1fr)_8rem_8rem_auto] items-center gap-x-3';

export default function ListaRelatorios({ relatorios }: { relatorios: RelatorioResumoDTO[] }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [aExcluir, setAExcluir] = useState<RelatorioResumoDTO | null>(null);

  async function baixar(id: number) {
    setOcupado(id);
    setErro('');
    try {
      const res = await carregarRelatorio(id);
      if (!res.ok) setErro(res.error);
      else await baixarRelatorioPdf(res.data);
    } catch {
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setOcupado(null);
    }
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setOcupado(aExcluir.id);
    setErro('');
    const res = await excluirRelatorio(aExcluir.id);
    if (!res.ok) setErro(res.error);
    setOcupado(null);
    setAExcluir(null);
  }

  return (
    <Card>
      <SectionHead
        icon={<FilesIcon size={14} />}
        title="Relatórios salvos"
        description={
          relatorios.length === 0
            ? 'Nenhum relatório ainda'
            : `${relatorios.length} ${relatorios.length === 1 ? 'relatório' : 'relatórios'}`
        }
        action={
          <Link href="/relatorio/novo" style={fs(12, 13)} className={`${btnPrimario} no-underline`}>
            <PlusIcon size={14} weight="bold" />
            <span className="hidden sm:inline">Novo relatório</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        }
      />

      {erro && (
        <div className="px-4 pt-4 sm:px-5">
          <Alerta tipo="erro" texto={erro} />
        </div>
      )}

      {relatorios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <FilesIcon size={36} className="text-neutral-200" />
          <div>
            <p style={fs(13, 15)} className="font-medium text-neutral-700">
              Nenhum relatório salvo
            </p>
            <p style={fs(12, 13)} className="text-neutral-400">
              Crie o primeiro para calcular horas, deslocamento e refeições.
            </p>
          </div>
          <Link href="/relatorio/novo" style={fs(12, 13)} className={`${btnPrimario} no-underline`}>
            <PlusIcon size={14} weight="bold" />
            Criar relatório
          </Link>
        </div>
      ) : (
        <div>
          <div className={`${GRID} border-b border-neutral-100 bg-neutral-50 px-4 py-2 sm:px-5`}>
            {[
              { label: 'Nº', cls: '' },
              { label: 'Data', cls: 'hidden md:block' },
              { label: 'Descrição', cls: '' },
              { label: 'Equipe', cls: 'hidden md:block text-right' },
              { label: 'Total', cls: 'hidden md:block text-right' },
              { label: '', cls: '' },
            ].map(({ label, cls }, i) => (
              <span
                key={i}
                style={fs(10, 12)}
                className={`font-semibold tracking-wider text-neutral-400 uppercase ${cls}`}
              >
                {label}
              </span>
            ))}
          </div>

          <ul className="flex flex-col divide-y divide-neutral-100">
            {relatorios.map((r) => {
              const carregando = ocupado === r.id;
              return (
                <li key={r.id} className={`${GRID} group px-4 py-3 transition-colors hover:bg-neutral-50 sm:px-5`}>
                  <span style={fs(12, 13)} className="font-semibold text-neutral-400 tabular-nums">
                    {r.id}
                  </span>

                  <span style={fs(12, 13)} className="hidden items-center gap-1.5 text-neutral-600 md:flex">
                    <CalendarBlankIcon size={12} className="text-neutral-400" />
                    {formatDataISO(r.data)}
                    {r.dias > 1 && <span className="text-neutral-400">+{r.dias - 1}d</span>}
                  </span>

                  <Link
                    href={`/relatorio/${r.id}`}
                    className="flex min-w-0 flex-col no-underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-attech/20 focus-visible:outline-none"
                  >
                    <span style={fs(13, 15)} className="truncate font-medium text-neutral-900 group-hover:text-attech">
                      {r.descricao || <span className="font-normal text-neutral-400">Sem descrição</span>}
                    </span>
                    {/* No mobile, data, equipe e total vêm abaixo da descrição. */}
                    <span style={fs(11, 12)} className="flex flex-wrap gap-x-3 text-neutral-400 md:hidden">
                      <span>
                        {formatDataISO(r.data)}
                        {r.dias > 1 && ` · ${r.dias} dias`}
                      </span>
                      <span className="flex items-center gap-1">
                        <UsersIcon size={11} />
                        {r.colaboradores}
                      </span>
                      <span className="font-semibold text-neutral-700">{formatReais(r.total)}</span>
                    </span>
                  </Link>

                  <span
                    style={fs(12, 13)}
                    className="hidden items-center justify-end gap-1.5 text-neutral-600 tabular-nums md:flex"
                  >
                    <UsersIcon size={12} className="text-neutral-400" />
                    {r.colaboradores}
                  </span>

                  <span
                    style={fs(13, 14)}
                    className="hidden text-right font-semibold text-neutral-900 tabular-nums md:block"
                  >
                    {formatReais(r.total)}
                  </span>

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={carregando}
                      onClick={() => baixar(r.id)}
                      aria-label={`Baixar PDF do relatório nº ${r.id}`}
                      title="Baixar PDF"
                      className={btnIcone}
                    >
                      {carregando ? <SpinnerIcon size={15} className="animate-spin" /> : <FilePdfIcon size={15} />}
                    </button>
                    <button
                      type="button"
                      disabled={carregando}
                      onClick={() => setAExcluir(r)}
                      aria-label={`Excluir relatório nº ${r.id}`}
                      title="Excluir"
                      className={btnIconePerigo}
                    >
                      <TrashIcon size={15} />
                    </button>
                    <Link
                      href={`/relatorio/${r.id}`}
                      aria-label={`Abrir relatório nº ${r.id}`}
                      className="hidden size-8 items-center justify-center text-neutral-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-500 sm:flex"
                    >
                      <CaretRightIcon size={14} weight="bold" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmarExclusao
        aberto={!!aExcluir}
        titulo={`Excluir o relatório nº ${aExcluir?.id ?? ''}?`}
        descricao="O relatório e seus cálculos serão removidos. Esta ação não pode ser desfeita."
        excluindo={ocupado !== null && ocupado === aExcluir?.id}
        onFechar={() => setAExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </Card>
  );
}
