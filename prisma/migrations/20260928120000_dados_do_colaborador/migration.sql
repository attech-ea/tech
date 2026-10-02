-- Dados cadastrais do colaborador (aba Usuários).
ALTER TABLE "colaboradores" ADD COLUMN "cargo" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "cargo_documento" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "email" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "data_cadastro" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "data_nascimento" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "rg" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "cpf" TEXT;
ALTER TABLE "colaboradores" ADD COLUMN "treinamentos" TEXT[] DEFAULT ARRAY[]::TEXT[];
