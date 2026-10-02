-- Relatórios passam a ter vários dias de trabalho (data e horário de cada um).
CREATE TABLE "relatorio_dias" (
    "id" SERIAL NOT NULL,
    "ordem" INTEGER NOT NULL,
    "relatorio_id" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "data_saida" TEXT NOT NULL,
    "entrada" TEXT NOT NULL,
    "saida" TEXT NOT NULL,
    "ignorar_feriado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "relatorio_dias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "relatorio_dias_relatorio_id_idx" ON "relatorio_dias"("relatorio_id");

ALTER TABLE "relatorio_dias" ADD CONSTRAINT "relatorio_dias_relatorio_id_fkey"
  FOREIGN KEY ("relatorio_id") REFERENCES "relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada relatório existente vira um relatório de 1 dia.
INSERT INTO "relatorio_dias" ("ordem", "relatorio_id", "data", "data_saida", "entrada", "saida", "ignorar_feriado")
SELECT 0, r."id", r."data", r."data_saida", r."entrada", r."saida",
  COALESCE((SELECT i."ignorar_feriado" FROM "relatorio_itens" i WHERE i."relatorio_id" = r."id" ORDER BY i."ordem" LIMIT 1), false)
FROM "relatorios" r;

-- Dias em que cada colaborador trabalhou: os relatórios existentes tinham um único dia (posição 0).
ALTER TABLE "relatorio_itens" ADD COLUMN "dias_ordem" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
UPDATE "relatorio_itens" SET "dias_ordem" = ARRAY[0];

-- Data e horário saem do relatório e dos itens (agora vivem em `relatorio_dias`).
ALTER TABLE "relatorios" DROP COLUMN "data_saida", DROP COLUMN "entrada", DROP COLUMN "saida";
ALTER TABLE "relatorio_itens"
  DROP COLUMN "data", DROP COLUMN "data_saida", DROP COLUMN "entrada", DROP COLUMN "saida", DROP COLUMN "ignorar_feriado";
