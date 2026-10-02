-- Deslocamento passa a ser definido pela função (Irata/técnico = TECNICO).
ALTER TABLE "funcoes" ADD COLUMN "tipo_deslocamento" "TipoDeslocamento" NOT NULL DEFAULT 'COMUM';
UPDATE "funcoes" SET "tipo_deslocamento" = 'TECNICO' WHERE "irata";
ALTER TABLE "colaboradores" DROP COLUMN "tipo_deslocamento";
UPDATE "relatorio_itens" SET "tipo_deslocamento" = 'TECNICO' WHERE "irata";

-- Preço do item: por hora (normal) ou diária de 12h (Irata).
ALTER TABLE "relatorio_itens" RENAME COLUMN "preco_hora" TO "preco";

-- Data única do relatório, preenchida a partir dos itens existentes.
ALTER TABLE "relatorios" ADD COLUMN "data" TEXT;
UPDATE "relatorios" r SET "data" = COALESCE(
  (SELECT MIN(i."data") FROM "relatorio_itens" i WHERE i."relatorio_id" = r."id"),
  to_char(r."created_at", 'YYYY-MM-DD')
);
ALTER TABLE "relatorios" ALTER COLUMN "data" SET NOT NULL;
