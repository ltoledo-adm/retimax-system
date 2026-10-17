import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decimalToString } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import {
  CreateHerramientaDto,
  CreateVentaHerramientaDto,
  UpdateHerramientaDto,
} from './dto/herramienta.dto';

const herramientaInclude = {
  ventas: { select: { cantidad: true } },
} as const;

type HerramientaRow = Prisma.HerramientaGetPayload<{ include: typeof herramientaInclude }>;

function toHerramientaDto(row: HerramientaRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    precioCompraUsd: decimalToString(row.precioCompraUsd)!,
    medida: row.medida,
    dimensiones: row.dimensiones,
    cantidad: row.cantidad,
    fotoUrl: row.fotoUrl,
    thumbnailUrl: row.thumbnailUrl,
    activo: row.activo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class HerramientasService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async list() {
    const rows = await this.prisma.herramienta.findMany({
      where: { activo: true },
      include: herramientaInclude,
      orderBy: { nombre: 'asc' },
    });
    return rows.map(toHerramientaDto);
  }

  async create(dto: CreateHerramientaDto) {
    const precio = Number(dto.precioCompraUsd);
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    const row = await this.prisma.herramienta.create({
      data: {
        nombre: dto.nombre.trim(),
        precioCompraUsd: new Prisma.Decimal(dto.precioCompraUsd),
        medida: dto.medida?.trim() || null,
        dimensiones: dto.dimensiones?.trim() || null,
        cantidad: dto.cantidad ?? 1,
      },
      include: herramientaInclude,
    });
    return toHerramientaDto(row);
  }

  async update(id: string, dto: UpdateHerramientaDto) {
    await this.ensure(id);
    if (dto.precioCompraUsd) {
      const precio = Number(dto.precioCompraUsd);
      if (!Number.isFinite(precio) || precio <= 0) {
        throw new BadRequestException('El precio debe ser mayor a 0');
      }
    }

    const row = await this.prisma.herramienta.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        precioCompraUsd: dto.precioCompraUsd ? new Prisma.Decimal(dto.precioCompraUsd) : undefined,
        medida: dto.medida !== undefined ? dto.medida.trim() || null : undefined,
        dimensiones: dto.dimensiones !== undefined ? dto.dimensiones.trim() || null : undefined,
        cantidad: dto.cantidad,
      },
      include: herramientaInclude,
    });
    return toHerramientaDto(row);
  }

  async uploadFoto(id: string, file: Express.Multer.File) {
    await this.ensure(id);
    const stored = await this.storage.saveImage(file.buffer, file.originalname);
    const row = await this.prisma.herramienta.update({
      where: { id },
      data: { fotoUrl: stored.url, thumbnailUrl: stored.thumbnailUrl },
      include: herramientaInclude,
    });
    return toHerramientaDto(row);
  }

  async listVentas() {
    const rows = await this.prisma.ventaHerramienta.findMany({
      include: {
        cliente: { select: { id: true, nombre: true } },
        herramienta: { select: { id: true, nombre: true, medida: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((v) => this.toVentaDto(v));
  }

  async vender(dto: CreateVentaHerramientaDto) {
    const unitario = Number(dto.precioUnitarioUsd);
    const tipoCambio = Number(dto.tipoCambio);
    if (!Number.isFinite(unitario) || unitario <= 0) {
      throw new BadRequestException('El precio de venta debe ser mayor a 0');
    }
    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
      throw new BadRequestException('El tipo de cambio debe ser mayor a 0');
    }

    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) throw new BadRequestException('Cliente no encontrado');

    const venta = await this.prisma.$transaction(async (tx) => {
      const herramienta = await tx.herramienta.findUnique({ where: { id: dto.herramientaId } });
      if (!herramienta?.activo) throw new BadRequestException('Herramienta no encontrada');

      const descontado = await tx.herramienta.updateMany({
        where: { id: dto.herramientaId, activo: true, cantidad: { gte: dto.cantidad } },
        data: { cantidad: { decrement: dto.cantidad } },
      });
      if (descontado.count !== 1) {
        throw new BadRequestException(
          `Stock insuficiente. Disponible: ${herramienta.cantidad}`,
        );
      }

      const precioFinalUsd = new Prisma.Decimal(dto.precioUnitarioUsd).mul(dto.cantidad);
      const precioFinalBob = precioFinalUsd.mul(new Prisma.Decimal(dto.tipoCambio));

      const created = await tx.ventaHerramienta.create({
        data: {
          herramientaId: dto.herramientaId,
          clienteId: dto.clienteId,
          cantidad: dto.cantidad,
          precioUnitarioUsd: new Prisma.Decimal(dto.precioUnitarioUsd),
          precioFinalUsd,
          precioFinalBob,
          tipoCambio: new Prisma.Decimal(dto.tipoCambio),
          fechaEntrega: new Date(dto.fechaEntrega),
        },
        include: {
          cliente: { select: { id: true, nombre: true } },
          herramienta: { select: { id: true, nombre: true, medida: true } },
        },
      });

      return created;
    });

    return this.toVentaDto(venta);
  }

  private toVentaDto(v: {
    id: string;
    herramientaId: string;
    clienteId: string;
    cantidad: number;
    precioUnitarioUsd: Prisma.Decimal;
    precioFinalUsd: Prisma.Decimal;
    precioFinalBob: Prisma.Decimal;
    tipoCambio: Prisma.Decimal;
    fechaEntrega: Date;
    createdAt: Date;
    cliente?: { id: string; nombre: string };
    herramienta?: { id: string; nombre: string; medida: string | null };
  }) {
    return {
      id: v.id,
      herramientaId: v.herramientaId,
      herramienta: v.herramienta,
      clienteId: v.clienteId,
      cliente: v.cliente,
      cantidad: v.cantidad,
      precioUnitarioUsd: decimalToString(v.precioUnitarioUsd)!,
      precioFinalUsd: decimalToString(v.precioFinalUsd)!,
      precioFinalBob: decimalToString(v.precioFinalBob)!,
      tipoCambio: decimalToString(v.tipoCambio)!,
      fechaEntrega: v.fechaEntrega.toISOString(),
      createdAt: v.createdAt.toISOString(),
    };
  }

  private async ensure(id: string) {
    const row = await this.prisma.herramienta.findUnique({ where: { id } });
    if (!row || !row.activo) throw new NotFoundException('Herramienta no encontrada');
    return row;
  }
}
