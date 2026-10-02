'use client';

import { EyeIcon, FileDashedIcon, SpinnerIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr';
import { useEffect, useState, type ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';
import { gerarRelatorioPdf } from './gerarPdf';
import type { RelatorioDTO } from './tipos';

// Espera o usuário parar de digitar antes de regerar o PDF.
const ATRASO_MS = 400;

export default function PreviaPdf({ relatorio }: { relatorio: RelatorioDTO | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!relatorio) return;
    let cancelado = false;
    let urlGerada: string | null = null;

    const timer = setTimeout(async () => {
      try {
        const blob = await gerarRelatorioPdf(relatorio);
        if (cancelado) return;
        urlGerada = URL.createObjectURL(blob);
        setUrl(urlGerada);
        setErro(false);
      } catch {
        if (!cancelado) setErro(true);
      }
    }, ATRASO_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
      // Libera o PDF anterior só depois que o próximo já estiver no iframe.
      if (urlGerada) setTimeout(() => URL.revokeObjectURL(urlGerada!), 2000);
    };
  }, [relatorio]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-600">
          <EyeIcon size={14} />
        </div>
        <p style={fs(14, 16)} className="font-semibold tracking-tight text-neutral-800">
          Pré-visualização
        </p>
        {relatorio && !url && !erro && <SpinnerIcon size={14} className="ml-auto animate-spin text-neutral-400" />}
      </div>
      {erro ? (
        <Vazio
          icone={<WarningCircleIcon size={32} className="text-red-300" />}
          texto="Não foi possível gerar a pré-visualização."
        />
      ) : !relatorio ? (
        <Vazio
          icone={<FileDashedIcon size={32} className="text-neutral-200" />}
          texto="Preencha a data e o horário para ver o relatório."
        />
      ) : url ? (
        <iframe
          title="Pré-visualização do relatório"
          src={`${url}#toolbar=0&navpanes=0&view=FitH`}
          className="h-full w-full flex-1 bg-neutral-100"
        />
      ) : (
        <div className="flex-1 animate-pulse bg-neutral-50 p-8">
          <div className="mx-auto flex h-full max-w-md flex-col gap-3 rounded-lg bg-white p-6 shadow-sm">
            <div className="h-4 w-1/2 rounded bg-neutral-200" />
            <div className="h-3 w-1/3 rounded bg-neutral-100" />
            <div className="mt-4 h-24 rounded bg-neutral-100" />
            <div className="h-3 w-2/3 rounded bg-neutral-100" />
          </div>
        </div>
      )}
    </div>
  );
}

function Vazio({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      {icone}
      <p style={fs(12, 14)} className="max-w-60 text-neutral-400">
        {texto}
      </p>
    </div>
  );
}
