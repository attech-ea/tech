-- Entrada e saída passam a ser únicas por relatório (itens guardam uma cópia).
ALTER TABLE "relatorios" ADD COLUMN "entrada" TEXT, ADD COLUMN "saida" TEXT;
UPDATE "relatorios" r SET
  "entrada" = COALESCE((SELECT i."entrada" FROM "relatorio_itens" i WHERE i."relatorio_id" = r."id" ORDER BY i."ordem" LIMIT 1), '07:00'),
  "saida"   = COALESCE((SELECT i."saida"   FROM "relatorio_itens" i WHERE i."relatorio_id" = r."id" ORDER BY i."ordem" LIMIT 1), '17:00');
ALTER TABLE "relatorios" ALTER COLUMN "entrada" SET NOT NULL, ALTER COLUMN "saida" SET NOT NULL;
