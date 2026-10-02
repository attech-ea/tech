-- CreateTable
CREATE TABLE "colaboradores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcoes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ColaboradorToFuncao" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ColaboradorToFuncao_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcoes_nome_key" ON "funcoes"("nome");

-- CreateIndex
CREATE INDEX "_ColaboradorToFuncao_B_index" ON "_ColaboradorToFuncao"("B");

-- AddForeignKey
ALTER TABLE "_ColaboradorToFuncao" ADD CONSTRAINT "_ColaboradorToFuncao_A_fkey" FOREIGN KEY ("A") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColaboradorToFuncao" ADD CONSTRAINT "_ColaboradorToFuncao_B_fkey" FOREIGN KEY ("B") REFERENCES "funcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
