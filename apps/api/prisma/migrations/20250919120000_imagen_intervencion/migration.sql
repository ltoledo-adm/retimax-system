-- AlterTable
ALTER TABLE "imagenes_maquina" ADD COLUMN "intervencionId" TEXT;

-- CreateIndex
CREATE INDEX "imagenes_maquina_intervencionId_idx" ON "imagenes_maquina"("intervencionId");

-- AddForeignKey
ALTER TABLE "imagenes_maquina" ADD CONSTRAINT "imagenes_maquina_intervencionId_fkey" FOREIGN KEY ("intervencionId") REFERENCES "intervenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
