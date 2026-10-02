-- Data de saída única por relatório (antes era calculada pelo horário).
ALTER TABLE "relatorios" ADD COLUMN "data_saida" TEXT;
UPDATE "relatorios" r SET "data_saida" = COALESCE(
  (SELECT i."data_saida" FROM "relatorio_itens" i WHERE i."relatorio_id" = r."id" ORDER BY i."ordem" LIMIT 1),
  r."data"
);
ALTER TABLE "relatorios" ALTER COLUMN "data_saida" SET NOT NULL;
