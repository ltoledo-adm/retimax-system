import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoMaquina, EstadoPedido, Prisma } from '@prisma/client';
import {
  decimalToString,
  toMaquinaDto,
  toReciboReservaDto,
  toReciboVentaDto,
} from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { CreatePedidoDto, CreateVentaDto, UpdatePedidoDto, UpdatePedidoEstadoDto, UpdateVentaDto } from './dto/comercial.dto';

@Injectable()
export class ComercialService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async listPedidos() {
    const pedidos = await this.prisma.pedido.findMany({
      include: {
        cliente: true,
        maquina: { include: { proveedor: true } },
        reciboReserva: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return pedidos.map((p) => this.toPedidoDto(p));
  }

  async createPedido(dto: CreatePedidoDto, userId?: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) throw new BadRequestException('Cliente no encontrado');

    if (dto.maquinaId && dto.nuevaMaquina) {
      throw new BadRequestException('Indique una máquina existente o registre una nueva, no ambas');
    }

    if (dto.maquinaId) {
      const maquina = await this.prisma.maquina.findUnique({ where: { id: dto.maquinaId } });
      if (!maquina) throw new BadRequestException('Máquina no encontrada');
    }

    const pedido = await this.prisma.$transaction(async (tx) => {
      let maquinaId = dto.maquinaId;

      if (dto.nuevaMaquina) {
        if (!userId) throw new BadRequestException('Usuario requerido para registrar máquina');
        let proveedorId = dto.nuevaMaquina.proveedorId;
        if (!proveedorId) {
          const prov = await tx.proveedor.findFirst({ where: { nombre: 'Encargo / Reserva' } });
          if (!prov) throw new BadRequestException('Configure el proveedor "Encargo / Reserva"');
          proveedorId = prov.id;
        }

        const nm = dto.nuevaMaquina;
        const maquina = await tx.maquina.create({
          data: {
            nombre: nm.nombre.trim(),
            tipo: nm.tipo?.trim() || '',
            marca: nm.marca.trim(),
            modelo: nm.modelo.trim(),
            anio: nm.anio,
            proveedorId,
            estado: EstadoMaquina.RESERVADA,
            descripcionAcordada: `Reserva para ${cliente.nombre}`,
            creadoPorId: userId,
          },
        });
        await tx.historialEstado.create({
          data: {
            maquinaId: maquina.id,
            estado: EstadoMaquina.RESERVADA,
            anterior: null,
            motivo: `Reserva — cliente ${cliente.nombre}`,
            creadoPorId: userId,
          },
        });
        maquinaId = maquina.id;
      }

      const created = await tx.pedido.create({
        data: {
          clienteId: dto.clienteId,
          maquinaId,
          descripcionReferencia: dto.descripcionReferencia,
          anticipoUsd: new Prisma.Decimal(dto.anticipoUsd),
          saldoUsd: new Prisma.Decimal(dto.saldoUsd),
          totalUsd: new Prisma.Decimal(dto.totalUsd),
          fechaEntregaEstimada: dto.fechaEntregaEstimada
            ? new Date(dto.fechaEntregaEstimada)
            : undefined,
        },
        include: { cliente: true, maquina: { include: { proveedor: true } } },
      });

      const numero = await this.nextReciboNumero(tx, 'RR');
      await tx.reciboReserva.create({
        data: { numero, pedidoId: created.id },
      });

      if (created.maquinaId && !dto.nuevaMaquina) {
        await tx.maquina.update({
          where: { id: created.maquinaId },
          data: { estado: EstadoMaquina.RESERVADA },
        });
      }

      return tx.pedido.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          cliente: true,
          maquina: { include: { proveedor: true } },
          reciboReserva: true,
        },
      });
    });

    return this.toPedidoDto(pedido);
  }

  async getReciboReserva(pedidoId: string) {
    const recibo = await this.prisma.reciboReserva.findUnique({
      where: { pedidoId },
      include: {
        pedido: {
          include: {
            cliente: true,
            maquina: true,
          },
        },
      },
    });
    if (!recibo) throw new NotFoundException('Recibo de reserva no encontrado');
    return toReciboReservaDto({
      ...recibo,
      pedido: {
        id: recibo.pedido.id,
        anticipoUsd: recibo.pedido.anticipoUsd,
        saldoUsd: recibo.pedido.saldoUsd,
        totalUsd: recibo.pedido.totalUsd,
        fechaEntregaEstimada: recibo.pedido.fechaEntregaEstimada,
        descripcionReferencia: recibo.pedido.descripcionReferencia,
        createdAt: recibo.pedido.createdAt,
        cliente: {
          nombre: recibo.pedido.cliente.nombre,
          telefono: recibo.pedido.cliente.telefono,
        },
        maquina: recibo.pedido.maquina
          ? { nombre: recibo.pedido.maquina.nombre, tipo: recibo.pedido.maquina.tipo }
          : null,
      },
    });
  }

  async updatePedidoEstado(id: string, dto: UpdatePedidoEstadoDto) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const updated = await this.prisma.pedido.update({
      where: { id },
      data: { estado: dto.estado },
      include: {
        cliente: true,
        maquina: { include: { proveedor: true } },
        reciboReserva: true,
      },
    });

    if (dto.estado === EstadoPedido.CANCELADO && updated.maquinaId) {
      await this.prisma.maquina.update({
        where: { id: updated.maquinaId },
        data: { estado: EstadoMaquina.LISTA_PARA_VENTA },
      });
    }

    return this.toPedidoDto(updated);
  }

  async updatePedido(id: string, dto: UpdatePedidoDto) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const updated = await this.prisma.pedido.update({
      where: { id },
      data: {
        clienteId: dto.clienteId,
        maquinaId: dto.maquinaId,
        descripcionReferencia: dto.descripcionReferencia,
        anticipoUsd: dto.anticipoUsd ? new Prisma.Decimal(dto.anticipoUsd) : undefined,
        saldoUsd: dto.saldoUsd ? new Prisma.Decimal(dto.saldoUsd) : undefined,
        totalUsd: dto.totalUsd ? new Prisma.Decimal(dto.totalUsd) : undefined,
        fechaEntregaEstimada: dto.fechaEntregaEstimada
          ? new Date(dto.fechaEntregaEstimada)
          : undefined,
      },
      include: {
        cliente: true,
        maquina: { include: { proveedor: true } },
        reciboReserva: true,
      },
    });
    return this.toPedidoDto(updated);
  }

  async listVentas() {
    const ventas = await this.prisma.venta.findMany({
      include: {
        cliente: true,
        maquina: { include: { proveedor: true } },
        reciboVenta: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return ventas.map((v) => this.toVentaDto(v));
  }

  async createVenta(dto: CreateVentaDto) {
    const maquina = await this.prisma.maquina.findUnique({
      where: { id: dto.maquinaId },
      include: { venta: true },
    });
    if (!maquina) throw new BadRequestException('Máquina no encontrada');
    if (maquina.venta) throw new BadRequestException('La máquina ya fue vendida');
    if (
      maquina.estado !== EstadoMaquina.LISTA_PARA_VENTA &&
      maquina.estado !== EstadoMaquina.RESERVADA
    ) {
      throw new BadRequestException('La máquina no está lista para venta');
    }

    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) throw new BadRequestException('Cliente no encontrado');

    const venta = await this.prisma.$transaction(async (tx) => {
      const created = await tx.venta.create({
        data: {
          maquinaId: dto.maquinaId,
          clienteId: dto.clienteId,
          precioFinalUsd: new Prisma.Decimal(dto.precioFinalUsd),
          precioFinalBob: new Prisma.Decimal(dto.precioFinalBob),
          tipoCambio: new Prisma.Decimal(dto.tipoCambio),
          fechaEntrega: new Date(dto.fechaEntrega),
        },
        include: {
          cliente: true,
          maquina: { include: { proveedor: true } },
        },
      });

      const numero = await this.nextReciboNumero(tx, 'RV');
      await tx.reciboVenta.create({
        data: { numero, ventaId: created.id },
      });

      await tx.maquina.update({
        where: { id: dto.maquinaId },
        data: {
          estado: EstadoMaquina.VENDIDA,
          precioVentaUsd: new Prisma.Decimal(dto.precioFinalUsd),
          precioVentaBob: new Prisma.Decimal(dto.precioFinalBob),
          tipoCambioUsado: new Prisma.Decimal(dto.tipoCambio),
        },
      });

      return tx.venta.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          cliente: true,
          maquina: { include: { proveedor: true } },
          reciboVenta: true,
        },
      });
    });

    return this.toVentaDto(venta);
  }

  async updateVenta(id: string, dto: UpdateVentaDto) {
    const venta = await this.prisma.venta.findUnique({ where: { id } });
    if (!venta) throw new NotFoundException('Venta no encontrada');

    const updated = await this.prisma.venta.update({
      where: { id },
      data: {
        clienteId: dto.clienteId,
        precioFinalUsd: dto.precioFinalUsd ? new Prisma.Decimal(dto.precioFinalUsd) : undefined,
        precioFinalBob: dto.precioFinalBob ? new Prisma.Decimal(dto.precioFinalBob) : undefined,
        tipoCambio: dto.tipoCambio ? new Prisma.Decimal(dto.tipoCambio) : undefined,
        fechaEntrega: dto.fechaEntrega ? new Date(dto.fechaEntrega) : undefined,
      },
      include: {
        cliente: true,
        maquina: { include: { proveedor: true } },
        reciboVenta: true,
      },
    });
    return this.toVentaDto(updated);
  }

  async getReciboVenta(ventaId: string) {
    const recibo = await this.prisma.reciboVenta.findUnique({
      where: { ventaId },
      include: {
        venta: {
          include: {
            cliente: true,
            maquina: { include: { proveedor: true } },
          },
        },
      },
    });
    if (!recibo) throw new NotFoundException('Recibo de venta no encontrado');
    return toReciboVentaDto({
      ...recibo,
      venta: {
        id: recibo.venta.id,
        precioFinalUsd: recibo.venta.precioFinalUsd,
        precioFinalBob: recibo.venta.precioFinalBob,
        tipoCambio: recibo.venta.tipoCambio,
        fechaEntrega: recibo.venta.fechaEntrega,
        createdAt: recibo.venta.createdAt,
        cliente: {
          nombre: recibo.venta.cliente.nombre,
          telefono: recibo.venta.cliente.telefono,
        },
        maquina: {
          nombre: recibo.venta.maquina.nombre,
          tipo: recibo.venta.maquina.tipo,
          proveedor: recibo.venta.maquina.proveedor,
        },
      },
    });
  }

  private async nextReciboNumero(
    tx: Prisma.TransactionClient,
    prefix: 'RV' | 'RR',
  ): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-`;
    const last =
      prefix === 'RV'
        ? await tx.reciboVenta.findFirst({
            where: { numero: { startsWith: pattern } },
            orderBy: { numero: 'desc' },
          })
        : await tx.reciboReserva.findFirst({
            where: { numero: { startsWith: pattern } },
            orderBy: { numero: 'desc' },
          });
    const seq = last ? parseInt(last.numero.split('-')[2] ?? '0', 10) + 1 : 1;
    return `${pattern}${String(seq).padStart(4, '0')}`;
  }

  private toPedidoDto(pedido: {
    id: string;
    clienteId: string;
    maquinaId: string | null;
    descripcionReferencia: string | null;
    fotoReferenciaUrl: string | null;
    anticipoUsd: Prisma.Decimal;
    saldoUsd: Prisma.Decimal;
    totalUsd: Prisma.Decimal;
    fechaEntregaEstimada: Date | null;
    estado: EstadoPedido;
    createdAt: Date;
    updatedAt: Date;
    cliente: { id: string; nombre: string; telefono: string | null; notas: string | null; createdAt: Date };
    maquina?: {
      id: string;
      nombre: string;
      tipo: string;
      marca: string;
      modelo: string;
      anio: number | null;
      proveedorId: string;
      estado: string;
      descripcionLlegada: string | null;
      precioVentaUsd: Prisma.Decimal | null;
      tipoCambioUsado: Prisma.Decimal | null;
      precioVentaBob: Prisma.Decimal | null;
      fechaCompra: Date | null;
      fechaLlegadaEstimada: Date | null;
      fechaLlegadaReal: Date | null;
      createdAt: Date;
      updatedAt: Date;
      proveedor: { id: string; nombre: string; createdAt: Date };
    } | null;
    reciboReserva?: { id: string; numero: string; fechaEmision: Date; vigenciaDias: number } | null;
  }) {
    return {
      id: pedido.id,
      clienteId: pedido.clienteId,
      cliente: {
        id: pedido.cliente.id,
        nombre: pedido.cliente.nombre,
        telefono: pedido.cliente.telefono,
        notas: pedido.cliente.notas,
        createdAt: pedido.cliente.createdAt.toISOString(),
      },
      maquinaId: pedido.maquinaId,
      maquina: pedido.maquina ? toMaquinaDto(pedido.maquina) : null,
      descripcionReferencia: pedido.descripcionReferencia,
      fotoReferenciaUrl: pedido.fotoReferenciaUrl,
      anticipoUsd: decimalToString(pedido.anticipoUsd)!,
      saldoUsd: decimalToString(pedido.saldoUsd)!,
      totalUsd: decimalToString(pedido.totalUsd)!,
      fechaEntregaEstimada: pedido.fechaEntregaEstimada?.toISOString() ?? null,
      estado: pedido.estado,
      reciboReserva: pedido.reciboReserva
        ? {
            id: pedido.reciboReserva.id,
            numero: pedido.reciboReserva.numero,
            fechaEmision: pedido.reciboReserva.fechaEmision.toISOString(),
            vigenciaDias: pedido.reciboReserva.vigenciaDias,
          }
        : null,
      createdAt: pedido.createdAt.toISOString(),
      updatedAt: pedido.updatedAt.toISOString(),
    };
  }

  private toVentaDto(venta: {
    id: string;
    maquinaId: string;
    clienteId: string;
    precioFinalUsd: Prisma.Decimal;
    precioFinalBob: Prisma.Decimal;
    tipoCambio: Prisma.Decimal;
    fechaEntrega: Date;
    createdAt: Date;
    cliente: { id: string; nombre: string; telefono: string | null; notas: string | null; createdAt: Date };
    maquina: {
      id: string;
      nombre: string;
      tipo: string;
      marca: string;
      modelo: string;
      anio: number | null;
      proveedorId: string;
      estado: string;
      descripcionLlegada: string | null;
      precioVentaUsd: Prisma.Decimal | null;
      tipoCambioUsado: Prisma.Decimal | null;
      precioVentaBob: Prisma.Decimal | null;
      fechaCompra: Date | null;
      fechaLlegadaEstimada: Date | null;
      fechaLlegadaReal: Date | null;
      createdAt: Date;
      updatedAt: Date;
      proveedor: { id: string; nombre: string; createdAt: Date };
    };
    reciboVenta?: { id: string; numero: string; fechaEmision: Date } | null;
  }) {
    return {
      id: venta.id,
      maquinaId: venta.maquinaId,
      maquina: toMaquinaDto(venta.maquina),
      clienteId: venta.clienteId,
      cliente: {
        id: venta.cliente.id,
        nombre: venta.cliente.nombre,
        telefono: venta.cliente.telefono,
        notas: venta.cliente.notas,
        createdAt: venta.cliente.createdAt.toISOString(),
      },
      precioFinalUsd: decimalToString(venta.precioFinalUsd)!,
      precioFinalBob: decimalToString(venta.precioFinalBob)!,
      tipoCambio: decimalToString(venta.tipoCambio)!,
      fechaEntrega: venta.fechaEntrega.toISOString(),
      reciboVenta: venta.reciboVenta
        ? {
            id: venta.reciboVenta.id,
            numero: venta.reciboVenta.numero,
            fechaEmision: venta.reciboVenta.fechaEmision.toISOString(),
          }
        : null,
      createdAt: venta.createdAt.toISOString(),
    };
  }
}
