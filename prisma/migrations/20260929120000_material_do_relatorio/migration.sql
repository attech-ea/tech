-- Valor do material do serviço (0 = sem material).
ALTER TABLE "relatorios" ADD COLUMN "material" DECIMAL(10,2) NOT NULL DEFAULT 0;
