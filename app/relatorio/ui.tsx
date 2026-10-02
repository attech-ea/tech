'use client';

import { CheckCircleIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr';
import { useEffect, type ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';

// Estilos compartilhados do módulo Relatório, alinhados ao design system do CRM.

export const inputClass =
  'h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-[13px] text-neutral-900 placeholder-neutral-400 outline-none transition-all duration-150 focus:border-neutral-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60';

export const btnPrimario =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 w-full rounded-lg bg-attech px-3.5 py-2 font-medium text-white transition-all duration-150 ease-out hover:bg-attech-dark focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 font-medium text-neutral-600 transition-all duration-150 ease-out hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

// Botão quadrado só com ícone (ações de linha). Sempre com `aria-label`/`title`.
export const btnIcone =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-all duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

export const btnIconePerigo = `${btnIcone} hover:border-red-200 hover:bg-red-50 hover:text-red-600`;

export const checkboxClass = 'size-4 cursor-pointer rounded accent-attech';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionHead({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-600">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 style={fs(14, 16)} className="font-semibold tracking-tight text-neutral-800">
            {title}
          </h2>
          {description && (
            <p style={fs(12, 13)} className="text-neutral-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  labelAction,
  className = '',
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} style={fs(12, 13)} className="font-medium text-neutral-500">
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {hint && !error && (
        <p style={fs(11, 12)} className="text-neutral-400">
          {hint}
        </p>
      )}
      {error && (
        <p style={fs(11, 12)} className="text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Alerta({ tipo, texto }: { tipo: 'erro' | 'sucesso'; texto: string }) {
  if (!texto) return null;
  const erro = tipo === 'erro';
  const Icone = erro ? WarningCircleIcon : CheckCircleIcon;
  return (
    <p
      role={erro ? 'alert' : 'status'}
      style={fs(12, 13)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
        erro ? 'border-red-100 bg-red-50 text-red-700' : 'border-green-100 bg-green-50 text-green-700'
      }`}
    >
      <Icone size={14} weight="fill" className="shrink-0" />
      {texto}
    </p>
  );
}

export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscape();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}

// Substitui o `window.confirm` nas exclusões.
export function ConfirmarExclusao({
  aberto,
  titulo,
  descricao,
  excluindo = false,
  rotulo = 'Excluir',
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  excluindo?: boolean;
  // Texto do botão de confirmação (o padrão serve às exclusões).
  rotulo?: string;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  useEscapeKey(onFechar, aberto && !excluindo);
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={excluindo ? undefined : onFechar} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-exclusao-titulo"
        className="relative z-10 flex w-full max-w-md flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <TrashIcon size={20} weight="fill" className="text-red-500" />
          </div>
          <div>
            <p id="confirmar-exclusao-titulo" className="text-base font-semibold text-neutral-900">
              {titulo}
            </p>
            <p className="mt-1 text-sm text-neutral-500">{descricao}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" autoFocus onClick={onFechar} disabled={excluindo} className={`${btnSecundario} text-sm`}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={excluindo}
            className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {excluindo ? 'Excluindo…' : rotulo}
          </button>
        </div>
      </div>
    </div>
  );
}
