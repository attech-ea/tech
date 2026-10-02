-- CreateEnum
CREATE TYPE "TipoDeslocamento" AS ENUM ('COMUM', 'TECNICO');

-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "tipo_deslocamento" "TipoDeslocamento" NOT NULL DEFAULT 'COMUM';

-- AlterTable
ALTER TABLE "funcoes" ADD COLUMN     "irata" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "relatorios" (
    "id" SERIAL NOT NULL,
    "descricao" TEXT,
    "km_quantidade" DECIMAL(10,2) NOT NULL,
    "km_preco" DECIMAL(10,2) NOT NULL,
    "deslocamento_horas" DECIMAL(10,2) NOT NULL,
    "desloc_preco_comum" DECIMAL(10,2) NOT NULL,
    "desloc_preco_tecnico" DECIMAL(10,2) NOT NULL,
    "preco_almoco" DECIMAL(10,2) NOT NULL,
    "preco_jantar" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio_itens" (
    "id" SERIAL NOT NULL,
    "ordem" INTEGER NOT NULL,
    "relatorio_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER,
    "funcao_id" INTEGER,
    "colaborador_nome" TEXT NOT NULL,
    "funcao_nome" TEXT NOT NULL,
    "irata" BOOLEAN NOT NULL,
    "tipo_deslocamento" "TipoDeslocamento" NOT NULL,
    "preco_hora" DECIMAL(10,2) NOT NULL,
    "data" TEXT NOT NULL,
    "data_saida" TEXT NOT NULL,
    "entrada" TEXT NOT NULL,
    "saida" TEXT NOT NULL,
    "ignorar_feriado" BOOLEAN NOT NULL DEFAULT false,
    "almoco" BOOLEAN NOT NULL,
    "jantar" BOOLEAN NOT NULL,
    "normal_min" INTEGER NOT NULL,
    "cem_min" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "relatorio_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relatorio_itens_relatorio_id_idx" ON "relatorio_itens"("relatorio_id");

-- AddForeignKey
ALTER TABLE "relatorio_itens" ADD CONSTRAINT "relatorio_itens_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorio_itens" ADD CONSTRAINT "relatorio_itens_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorio_itens" ADD CONSTRAINT "relatorio_itens_funcao_id_fkey" FOREIGN KEY ("funcao_id") REFERENCES "funcoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
