-- CreateTable
CREATE TABLE "avances_diarios" (
    "id" TEXT NOT NULL,
    "intervencionId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "observaciones" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registradoPorId" TEXT NOT NULL,

    CONSTRAINT "avances_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "herramientas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioCompraUsd" DECIMAL(10,2) NOT NULL,
    "medida" TEXT,
    "dimensiones" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "fotoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "herramientas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_herramienta" (
    "id" TEXT NOT NULL,
    "herramientaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioUsd" DECIMAL(10,2) NOT NULL,
    "precioFinalUsd" DECIMAL(10,2) NOT NULL,
    "precioFinalBob" DECIMAL(10,2) NOT NULL,
    "tipoCambio" DECIMAL(10,4) NOT NULL,
    "fechaEntrega" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_herramienta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avances_diarios_intervencionId_idx" ON "avances_diarios"("intervencionId");

-- CreateIndex
CREATE INDEX "avances_diarios_registradoEn_idx" ON "avances_diarios"("registradoEn");

-- CreateIndex
CREATE INDEX "ventas_herramienta_herramientaId_idx" ON "ventas_herramienta"("herramientaId");

-- CreateIndex
CREATE INDEX "ventas_herramienta_clienteId_idx" ON "ventas_herramienta"("clienteId");

-- CreateIndex
CREATE INDEX "ventas_herramienta_createdAt_idx" ON "ventas_herramienta"("createdAt");

-- AddForeignKey
ALTER TABLE "avances_diarios" ADD CONSTRAINT "avances_diarios_intervencionId_fkey" FOREIGN KEY ("intervencionId") REFERENCES "intervenciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_diarios" ADD CONSTRAINT "avances_diarios_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_herramienta" ADD CONSTRAINT "ventas_herramienta_herramientaId_fkey" FOREIGN KEY ("herramientaId") REFERENCES "herramientas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_herramienta" ADD CONSTRAINT "ventas_herramienta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
