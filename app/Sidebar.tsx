'use client';

import {
  AnchorIcon,
  BedIcon,
  BriefcaseIcon,
  ClockIcon,
  FilePlusIcon,
  FilesIcon,
  ForkKnifeIcon,
  ListIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { Icon } from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fs } from '@/lib/calc-clamp';

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  // Por padrão o item fica ativo na própria rota e nas filhas.
  ativo?: (pathname: string) => boolean;
}

interface NavSecao {
  label: string;
  itens: NavItem[];
}

// "/relatorio/[id]" (edição) conta como Relatórios; "novo" tem item próprio.
const SUBROTAS_RELATORIO = ['/relatorio/novo'];

const SECOES: NavSecao[] = [
  {
    label: 'Relatório',
    itens: [
      {
        href: '/relatorio',
        label: 'Relatórios',
        icon: FilesIcon,
        ativo: (p) => (p === '/relatorio' || p.startsWith('/relatorio/')) && !SUBROTAS_RELATORIO.some((s) => p.startsWith(s)),
      },
      { href: '/relatorio/novo', label: 'Novo relatório', icon: FilePlusIcon },
    ],
  },
  {
    label: 'Cadastros',
    itens: [
      { href: '/usuarios', label: 'Usuários', icon: UsersThreeIcon },
      { href: '/funcoes', label: 'Funções', icon: BriefcaseIcon },
    ],
  },
  {
    label: 'Utils',
    itens: [
      { href: '/alimentacao', label: 'Alimentação', icon: ForkKnifeIcon },
      { href: '/calculo', label: 'Cálculo de Horas', icon: ClockIcon },
      { href: '/recibo-airbnb', label: 'Recibo Airbnb', icon: BedIcon },
      { href: '/liberacao', label: 'Liberação', icon: AnchorIcon },
    ],
  },
];

function estaAtivo(item: NavItem, pathname: string): boolean {
  if (item.ativo) return item.ativo(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Marca() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-lg no-underline focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none"
    >
      <Image src="/logo-escudo.png" alt="" width={25} height={30} priority className="h-7.5 w-auto shrink-0" />
      <span className="flex flex-col leading-tight">
        <span style={fs(14, 15)} className="font-semibold tracking-tight text-neutral-900">
          Attech
        </span>
        <span style={fs(10, 11)} className="text-neutral-400">
          Eletrônica e Automação
        </span>
      </span>
    </Link>
  );
}

function Navegacao({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {SECOES.map((secao) => (
        <div key={secao.label} className="flex flex-col gap-1">
          <p
            style={fs(10, 11)}
            className="px-2 pb-0.5 font-semibold tracking-widest whitespace-nowrap text-neutral-400 uppercase"
          >
            {secao.label}
          </p>
          <ul className="flex flex-col gap-px">
            {secao.itens.map((item) => {
              const ativo = estaAtivo(item, pathname);
              const Icone = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={ativo ? 'page' : undefined}
                    style={fs(13, 14)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium no-underline transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none ${
                      ativo
                        ? 'bg-attech text-white'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                    }`}
                  >
                    <Icone size={16} weight={ativo ? 'fill' : 'regular'} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname() ?? '';
  const [aberta, setAberta] = useState(false);

  // Qualquer navegação (inclusive pelo logo) fecha a gaveta.
  const [rotaAnterior, setRotaAnterior] = useState(pathname);
  if (rotaAnterior !== pathname) {
    setRotaAnterior(pathname);
    setAberta(false);
  }

  // Gaveta do mobile: Esc fecha e o fundo não rola enquanto está aberta.
  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberta(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberta]);

  return (
    <>
      {/* Desktop: sidebar fixa */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-neutral-100 px-5">
          <Marca />
        </div>
        <Navegacao pathname={pathname} />
      </aside>

      {/* Mobile: barra no topo + gaveta */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
        <Marca />
        <button
          type="button"
          onClick={() => setAberta(true)}
          aria-label="Abrir menu"
          aria-expanded={aberta}
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none"
        >
          <ListIcon size={20} />
        </button>
      </header>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${aberta ? '' : 'pointer-events-none'}`}
        aria-hidden={!aberta}
      >
        <div
          onClick={() => setAberta(false)}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
            aberta ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          inert={!aberta}
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
            aberta ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 px-4">
            <Marca />
            <button
              type="button"
              onClick={() => setAberta(false)}
              aria-label="Fechar menu"
              className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none"
            >
              <XIcon size={18} />
            </button>
          </div>
          <Navegacao pathname={pathname} onNavigate={() => setAberta(false)} />
        </aside>
      </div>
    </>
  );
}
