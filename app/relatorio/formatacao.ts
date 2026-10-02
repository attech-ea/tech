// Formatação de textos de cadastro, compartilhada entre as Server Actions e o seed.

export function limparEspacos(s: string | undefined | null): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

// Funções são sempre gravadas em maiúsculas.
export function formatarFuncao(s: string | undefined | null): string {
  return limparEspacos(s).toLocaleUpperCase('pt-BR');
}

const PARTICULAS = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e']);

// Nomes de colaboradores: só a inicial de cada nome em maiúscula ("JOÃO DA SILVA" → "João da Silva").
export function formatarNome(s: string | undefined | null): string {
  return limparEspacos(s)
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1)))
    .join(' ');
}
