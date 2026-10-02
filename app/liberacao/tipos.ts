export interface DestinatarioDTO {
  id: number;
  nome: string;
  email: string;
}

// Um integrante da equipe, com os dados que vão no corpo do e-mail.
export interface PessoaLiberacao {
  nome: string;
  rg: string;
  cpf: string;
  // "YYYY-MM-DD".
  dataNascimento: string;
}

// Tudo o que muda de um e-mail para o outro.
export interface LiberacaoDTO {
  destinatario: DestinatarioDTO;
  embarcacao: string;
  // Dia do acesso, "YYYY-MM-DD".
  data: string;
  equipe: PessoaLiberacao[];
}
