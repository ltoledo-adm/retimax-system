-- El pago en dólares en efectivo no lleva tipo de cambio ni monto en bolivianos.
ALTER TABLE "ventas" ALTER COLUMN "precioFinalBob" DROP NOT NULL;
ALTER TABLE "ventas" ALTER COLUMN "tipoCambio" DROP NOT NULL;
