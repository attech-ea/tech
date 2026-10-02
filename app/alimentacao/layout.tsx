import type { ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';

export default function AlimentacaoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-neutral-50 text-neutral-700 lg:min-h-screen">
      <div className="mx-auto flex w-full max-w-350 flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">
        <header className="flex flex-col gap-1">
          <h1 style={fs(18, 22)} className="font-semibold tracking-tight text-neutral-900">
            Pedido de mesa — Alimentação
          </h1>
          <p style={fs(12, 14)} className="text-neutral-400">
            Preenche o formulário da pensão com a data, as refeições e o total, pronto para baixar em PDF
          </p>
        </header>
        <main className="flex flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
