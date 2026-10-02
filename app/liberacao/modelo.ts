// Partes fixas do e-mail de Solicitação de Liberação (o que não muda entre os envios).
export const MODELO = {
  assunto: 'Solicitação de Liberação',
  // Prefixo do assunto e da linha "embarcação" (ex.: "CBO WISER").
  operadora: 'CBO',
  embarcacaoPadrao: 'Wiser',
  de: { nome: 'Vanessa Pessoa', email: 'vanessapessoa@attechsea.com.br' },
  cc: 'administrativo@attechsea.com.br',
  assinatura: {
    setor: 'Setor Administrativo',
    contato: '(21)9 6813-9393',
    site: 'attechsea.com.br',
  },
  logoUrl: '/logo-attech.png',
};

export function assuntoLiberacao(embarcacao: string): string {
  return `${MODELO.assunto} - ${MODELO.operadora} ${embarcacao.toLocaleUpperCase('pt-BR')}`;
}
