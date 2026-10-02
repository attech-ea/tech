-- Alimentação pode ser informada à mão (ex.: nota fiscal); nulo = valor das refeições marcadas.
ALTER TABLE "relatorios" ADD COLUMN "alimentacao_manual" DECIMAL(10,2);

-- Deslocamento passa a ser uma lista de viagens, com data e horário (normal x 100%).
-- Relatórios existentes seguem com as horas fixas de `deslocamento_horas`, sem viagens.
CREATE TABLE "relatorio_deslocamentos" (
    "id" SERIAL NOT NULL,
    "ordem" INTEGER NOT NULL,
    "relatorio_id" INTEGER NOT NULL,
    "rotulo" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "data_saida" TEXT NOT NULL,
    "entrada" TEXT NOT NULL,
    "saida" TEXT NOT NULL,
    "ignorar_feriado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "relatorio_deslocamentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "relatorio_deslocamentos_relatorio_id_idx" ON "relatorio_deslocamentos"("relatorio_id");

ALTER TABLE "relatorio_deslocamentos" ADD CONSTRAINT "relatorio_deslocamentos_relatorio_id_fkey"
  FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
