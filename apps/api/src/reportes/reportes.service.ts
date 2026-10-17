import { Injectable } from '@nestjs/common';
import { EstadoMaquina, EstadoPedido } from '@prisma/client';
import { decimalToString } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumen() {
    const [maquinas, ventas, totalClientes, totalProveedores] = await Promise.all([
      this.prisma.maquina.findMany({
        include: {
          proveedor: true,
          creadoPor: { select: { id: true, nombre: true } },
          venta: { include: { cliente: true } },
          pedidos: {
            where: { estado: { not: EstadoPedido.CANCELADO } },
            include: { cliente: true },
            orderBy: { createdAt: 'desc' },
          },
          imagenes: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.venta.findMany({
        include: {
          cliente: true,
          maquina: { include: { proveedor: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cliente.count(),
      this.prisma.proveedor.count(),
    ]);

    const porEstado = Object.values(EstadoMaquina).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoMaquina, number>,
    );
    for (const m of maquinas) {
      porEstado[m.estado] += 1;
    }

    let totalVentasUsd = 0;
    let totalVentasBob = 0;
    for (const v of ventas) {
      totalVentasUsd += Number(v.precioFinalUsd);
      totalVentasBob += Number(v.precioFinalBob);
    }

    return {
      resumen: {
        totalMaquinas: maquinas.length,
        totalVentas: ventas.length,
        totalClientes,
        totalProveedores,
        totalVentasUsd: totalVentasUsd.toFixed(2),
        totalVentasBob: totalVentasBob.toFixed(2),
        maquinasCompradas: porEstado.COMPRADA_ITALIA + porEstado.EN_TRANSITO,
        maquinasEnProceso:
          porEstado.RECIBIDA +
          porEstado.EN_DIAGNOSTICO +
          porEstado.EN_MANTENIMIENTO,
        maquinasDisponibles: porEstado.LISTA_PARA_VENTA,
        maquinasReservadas: porEstado.RESERVADA,
        maquinasVendidas: porEstado.VENDIDA,
      },
      porEstado,
      ventas: ventas.map((v) => ({
        id: v.id,
        maquinaId: v.maquinaId,
        maquinaNombre: v.maquina.nombre,
        maquinaTipo: v.maquina.tipo,
        proveedor: v.maquina.proveedor.nombre,
        clienteNombre: v.cliente.nombre,
        precioFinalUsd: decimalToString(v.precioFinalUsd)!,
        precioFinalBob: decimalToString(v.precioFinalBob)!,
        tipoCambio: decimalToString(v.tipoCambio)!,
        fechaEntrega: v.fechaEntrega.toISOString(),
        createdAt: v.createdAt.toISOString(),
      })),
      maquinas: maquinas.map((m) => {
        const pedidoActivo = m.pedidos.find((p) => p.estado !== EstadoPedido.CANCELADO);
        return {
          id: m.id,
          nombre: m.nombre,
          tipo: m.tipo,
          estado: m.estado,
          proveedor: m.proveedor.nombre,
          registradoPor: m.creadoPor.nombre,
          reservadaPor: pedidoActivo?.cliente.nombre ?? null,
          vendidaA: m.venta?.cliente.nombre ?? null,
          precioVentaUsd: decimalToString(m.precioVentaUsd),
          empleadoDiagnostico: m.empleadoDiagnostico,
          fechaDespacho: m.fechaDespacho?.toISOString() ?? null,
          fechaLlegadaReal: m.fechaLlegadaReal?.toISOString() ?? null,
          thumbnailUrl: m.imagenes[0]?.thumbnailUrl ?? null,
          updatedAt: m.updatedAt.toISOString(),
        };
      }),
      clientes: await this.prisma.cliente.findMany({
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          telefono: true,
          _count: { select: { ventas: true, pedidos: true } },
        },
      }).then((rows) =>
        rows.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          totalVentas: c._count.ventas,
          totalPedidos: c._count.pedidos,
        })),
      ),
      proveedores: await this.prisma.proveedor.findMany({
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { maquinas: true } } },
      }).then((rows) =>
        rows.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          totalMaquinas: p._count.maquinas,
        })),
      ),
    };
  }

  async getTrabajos() {
    const rows = await this.prisma.intervencion.findMany({
      where: { responsableId: { not: null } },
      include: {
        responsable: true,
        maquina: { select: { id: true, nombre: true, tipo: true, estado: true } },
        registradoPor: { select: { nombre: true } },
        aprobadoPor: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((i) => ({
      id: i.id,
      maquinaId: i.maquinaId,
      maquinaNombre: i.maquina.nombre,
      maquinaTipo: i.maquina.tipo,
      maquinaEstado: i.maquina.estado,
      empleado: i.responsable
        ? `${i.responsable.nombre} ${i.responsable.apellido}`
        : i.responsableNombre,
      especialidad: i.responsable?.especialidad ?? null,
      area: i.area,
      tipo: i.tipo,
      descripcion: i.descripcion,
      detalleTrabajo: i.detalleTrabajo,
      observaciones: i.observaciones,
      estadoIntervencion: i.estadoIntervencion,
      estadoAprobacion: i.estadoAprobacion,
      fechaAsignacion: i.fechaAsignacion?.toISOString() ?? null,
      fechaInicio: i.fechaInicio?.toISOString() ?? null,
      fechaFinalizacion: i.fechaFinalizacion?.toISOString() ?? null,
      fechaAprobacion: i.fechaAprobacion?.toISOString() ?? null,
      registradoPor: i.registradoPor.nombre,
      aprobadoPor: i.aprobadoPor?.nombre ?? null,
      createdAt: i.createdAt.toISOString(),
    }));
  }

  async getHerramientas(desde?: string, hasta?: string) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      createdAt.gte = new Date(`${desde}T00:00:00.000-04:00`);
    }
    if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      createdAt.lte = new Date(`${hasta}T23:59:59.999-04:00`);
    }

    const [herramientas, ventas] = await Promise.all([
      this.prisma.herramienta.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.ventaHerramienta.findMany({
        where: Object.keys(createdAt).length ? { createdAt } : undefined,
        include: {
          cliente: { select: { id: true, nombre: true } },
          herramienta: { select: { id: true, nombre: true, medida: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const vendidasPorId = new Map<string, number>();
    let unidadesVendidas = 0;
    let totalUsd = 0;
    let totalBob = 0;
    for (const v of ventas) {
      unidadesVendidas += v.cantidad;
      totalUsd += Number(v.precioFinalUsd);
      totalBob += Number(v.precioFinalBob);
      vendidasPorId.set(v.herramientaId, (vendidasPorId.get(v.herramientaId) ?? 0) + v.cantidad);
    }

    return {
      stockTotal: herramientas.reduce((sum, h) => sum + h.cantidad, 0),
      unidadesVendidas,
      totalVendidoUsd: totalUsd.toFixed(2),
      totalVendidoBob: totalBob.toFixed(2),
      herramientas: herramientas.map((h) => ({
        id: h.id,
        nombre: h.nombre,
        precioCompraUsd: decimalToString(h.precioCompraUsd)!,
        medida: h.medida,
        dimensiones: h.dimensiones,
        cantidad: h.cantidad,
        thumbnailUrl: h.thumbnailUrl,
        unidadesVendidas: vendidasPorId.get(h.id) ?? 0,
      })),
      ventas: ventas.map((v) => ({
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
      })),
    };
  }
}
