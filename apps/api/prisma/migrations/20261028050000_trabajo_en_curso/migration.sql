-- El empleado que empieza una máquina queda registrado. Las máquinas ya cargadas no se borran.
CREATE TYPE "TipoMarcaCalendario" AS ENUM ('PAUSA', 'RETOMA');

ALTER TABLE "maquinas" ADD COLUMN "tomadaPorId" TEXT;
ALTER TABLE "maquinas" ADD COLUMN "tomadaEn" TIMESTAMP(3);

ALTER TABLE "maquinas"
  ADD CONSTRAINT "maquinas_tomadaPorId_fkey"
  FOREIGN KEY ("tomadaPorId") REFERENCES "empleados"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "intervenciones" ADD COLUMN "fechaFinEstimada" TIMESTAMP(3);
ALTER TABLE "intervenciones" ADD COLUMN "precioMantenimientoEstimado" DECIMAL(10,2);

ALTER TABLE "avances_diarios" ADD COLUMN "videoUrl" TEXT;

CREATE TABLE "marcas_calendario" (
  "id" TEXT NOT NULL,
  "intervencionId" TEXT NOT NULL,
  "tipo" "TipoMarcaCalendario" NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "motivo" TEXT NOT NULL,
  "creadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marcas_calendario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marcas_calendario_intervencionId_idx" ON "marcas_calendario"("intervencionId");

ALTER TABLE "marcas_calendario"
  ADD CONSTRAINT "marcas_calendario_intervencionId_fkey"
  FOREIGN KEY ("intervencionId") REFERENCES "intervenciones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marcas_calendario"
  ADD CONSTRAINT "marcas_calendario_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quien ya tiene un trabajo abierto sigue como responsable de esa máquina.
UPDATE "maquinas" m
SET "tomadaPorId" = sub."responsableId",
    "tomadaEn" = COALESCE(sub."fechaInicio", sub."createdAt")
FROM (
  SELECT DISTINCT ON ("maquinaId") "maquinaId", "responsableId", "fechaInicio", "createdAt"
  FROM "intervenciones"
  WHERE "responsableId" IS NOT NULL
    AND "tipo" = 'TRABAJO_REALIZADO'
    AND "estadoIntervencion" IN ('ASIGNADO', 'EN_PROCESO', 'RECHAZADO', 'FINALIZADO')
  ORDER BY "maquinaId", "fechaInicio" DESC NULLS LAST, "createdAt" DESC
) sub
WHERE m.id = sub."maquinaId"
  AND m."tomadaPorId" IS NULL;
