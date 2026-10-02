// Recadastra funções e colaboradores a partir de scripts/usuarios-data.json
// (lista de colaboradores) e da tabela de serviços PRIO.
//
// ATENÇÃO: apaga TODAS as funções e colaboradores antes de inserir. Relatórios
// já salvos não mudam (guardam cópia de nomes e preços; as referências viram null).
//
// Uso: npx tsx scripts/seed-usuarios.ts [--dry-run] [--producao]
// Por segurança só roda em banco local, a menos que passe --producao.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { formatarNome } from '../app/relatorio/formatacao';
import type { TipoDeslocamento } from '../app/relatorio/calculo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Bruto {
  nome: string;
  funcao: string | null;
  data_cadastro: string | null;
  data_nascimento: string | null;
  rg: string | null;
  cpf: string | null;
  treinamentos: string[];
  cargo_documento?: string;
  email?: string;
}

// Tabela de serviços PRIO: preço base por hora (Irata: diária de 12h). As faixas
// de 50%/100% e o deslocamento/km são calculados pelo relatório, não são funções.
// Deslocamento: "técnico" para técnicos e Irata, "outros" (comum) para o resto.
const FUNCOES_PRIO: { nome: string; preco: number; irata: boolean; tipoDeslocamento: TipoDeslocamento }[] = [
  { nome: 'AJUDANTE', preco: 300, irata: false, tipoDeslocamento: 'COMUM' },
  { nome: 'ENCANADOR', preco: 400, irata: false, tipoDeslocamento: 'COMUM' },
  { nome: 'IRATA N1', preco: 2000, irata: true, tipoDeslocamento: 'TECNICO' },
  { nome: 'IRATA N2', preco: 2400, irata: true, tipoDeslocamento: 'TECNICO' },
  { nome: 'IRATA N3', preco: 2800, irata: true, tipoDeslocamento: 'TECNICO' },
  { nome: 'SOLDADOR', preco: 400, irata: false, tipoDeslocamento: 'COMUM' },
  { nome: 'SUPERVISOR', preco: 500, irata: false, tipoDeslocamento: 'COMUM' },
  { nome: 'TECNICO', preco: 600, irata: false, tipoDeslocamento: 'TECNICO' },
];

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
}

// Funções PRIO de um colaborador: as do cargo + as que os treinamentos habilitam
// (Irata Nx e Solda). Demais treinamentos (altura, espaço confinado…) não viram função.
function derivarFuncoes(c: Bruto): string[] {
  const funcoes = new Set<string>();
  const cargo = semAcento(c.funcao ?? '');

  if (/AJUDANTE|MEIO OFICIAL/.test(cargo)) funcoes.add('AJUDANTE');
  if (/ENCANADOR/.test(cargo)) funcoes.add('ENCANADOR');
  if (/SOLDADOR/.test(cargo)) funcoes.add('SOLDADOR');
  if (cargo.includes('TECNICO')) funcoes.add('TECNICO'); // inclui "Eletrotécnico"
  if (/SUPERVISOR/.test(cargo)) funcoes.add('SUPERVISOR');

  for (const texto of [cargo, ...c.treinamentos.map(semAcento)]) {
    const irata = /^(?:.*\s)?IRATA N([123])$/.exec(texto);
    if (irata) funcoes.add(`IRATA N${irata[1]}`);
    if (texto === 'SOLDA') funcoes.add('SOLDADOR');
  }
  return [...funcoes].sort();
}

// "DD/MM/AAAA" → "AAAA-MM-DD"
function dataISO(br: string | null): string | null {
  if (!br) return null;
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!local && !process.argv.includes('--producao')) {
    throw new Error('DATABASE_URL não é local. Passe --producao se for mesmo para apagar e recriar esse banco.');
  }

  const dados: Bruto[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'usuarios-data.json'), 'utf8'));
  const nomesValidos = new Set(FUNCOES_PRIO.map((f) => f.nome));
  const plano = dados.map((c) => ({ c, funcoes: derivarFuncoes(c) }));
  for (const { c, funcoes } of plano) {
    if (funcoes.some((f) => !nomesValidos.has(f))) throw new Error(`Função fora da tabela PRIO em ${c.nome}`);
    console.log(`${formatarNome(c.nome).padEnd(36)} ${(c.funcao ?? '—').padEnd(44)} → ${funcoes.join(', ') || '(sem função)'}`);
  }
  if (dryRun) return;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await prisma.$transaction(async (tx) => {
      const [nColab, nFunc] = [await tx.colaborador.count(), await tx.funcao.count()];
      await tx.colaborador.deleteMany();
      await tx.funcao.deleteMany();
      console.log(`\nRemovidos: ${nColab} colaboradores, ${nFunc} funções.`);

      await tx.funcao.createMany({ data: FUNCOES_PRIO });
      const criadas = await tx.funcao.findMany();
      const idPorNome = new Map(criadas.map((f) => [f.nome, f.id]));

      for (const { c, funcoes } of plano) {
        await tx.colaborador.create({
          data: {
            nome: formatarNome(c.nome),
            cargo: c.funcao,
            cargoDocumento: c.cargo_documento ?? null,
            email: c.email ?? null,
            dataCadastro: dataISO(c.data_cadastro),
            dataNascimento: dataISO(c.data_nascimento),
            rg: c.rg,
            cpf: c.cpf,
            treinamentos: c.treinamentos,
            funcoes: { connect: funcoes.map((f) => ({ id: idPorNome.get(f)! })) },
          },
        });
      }
    }, { timeout: 60_000 });
    console.log(`Inseridos: ${plano.length} colaboradores, ${FUNCOES_PRIO.length} funções.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
