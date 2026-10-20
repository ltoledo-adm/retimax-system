-- Precio de compra puede quedar en dólares, euros o bolivianos.
-- Las máquinas ya registradas siguen en dólares.
CREATE TYPE "Moneda" AS ENUM ('USD', 'EUR', 'BOB');

ALTER TABLE "maquinas" ADD COLUMN "monedaCompra" "Moneda" NOT NULL DEFAULT 'USD';
