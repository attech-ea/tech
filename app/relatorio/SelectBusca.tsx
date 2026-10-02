'use client';

import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react/dist/ssr';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface OpcaoBusca {
  value: number;
  label: string;
}

interface Props {
  opcoes: OpcaoBusca[];
  value: number | null;
  onChange: (value: number) => void;
  // Texto mostrado quando o valor atual não está nas opções (ex.: colaborador excluído).
  textoAtual?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

// Busca sem diferenciar maiúsculas nem acentos ("joao" encontra "João").
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Seleção pesquisável: substitui o `<select>` nativo em todo o módulo.
export default function SelectBusca({
  opcoes,
  value,
  onChange,
  textoAtual = '',
  placeholder,
  disabled = false,
  id,
  className,
}: Props) {
  const listaId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);

  const selecionada = opcoes.find((o) => o.value === value);
  const textoSelecionado = selecionada?.label ?? textoAtual;

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return termo ? opcoes.filter((o) => normalizar(o.label).includes(termo)) : opcoes;
  }, [opcoes, busca]);

  // Mantém o item destacado visível ao navegar com as setas.
  useEffect(() => {
    if (aberto) listaRef.current?.querySelector(`[data-i="${destaque}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aberto, destaque]);

  function abrir() {
    if (disabled) return;
    setBusca('');
    setDestaque(Math.max(0, opcoes.findIndex((o) => o.value === value)));
    setAberto(true);
  }

  function escolher(opcao: OpcaoBusca) {
    onChange(opcao.value);
    setAberto(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!aberto && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      abrir();
      return;
    }
    if (!aberto) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtradas[destaque]) escolher(filtradas[destaque]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={aberto ? busca : textoSelecionado}
        placeholder={aberto ? textoSelecionado || placeholder : placeholder}
        onFocus={abrir}
        onClick={() => !aberto && abrir()}
        onBlur={() => setAberto(false)}
        onChange={(e) => {
          setBusca(e.target.value);
          setDestaque(0);
          setAberto(true);
        }}
        onKeyDown={onKeyDown}
        className={`${className ?? ''} pr-8`}
      />
      <CaretDownIcon
        size={12}
        className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 transition-transform duration-150 ${
          aberto ? 'rotate-180' : ''
        }`}
      />

      {aberto && (
        <ul
          id={listaId}
          ref={listaRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-neutral-400">Nenhuma opção</li>
          ) : (
            filtradas.map((o, i) => (
              <li
                key={o.value}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                // mousedown (e não click) para escolher antes do blur fechar a lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(o);
                }}
                onMouseEnter={() => setDestaque(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                  i === destaque ? 'bg-attech text-white' : 'text-neutral-700'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <CheckIcon size={12} weight="bold" className={i === destaque ? 'text-white' : 'text-attech'} />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
