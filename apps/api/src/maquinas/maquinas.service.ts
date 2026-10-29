import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AreaIntervencion,
  EstadoIntervencion,
  EstadoMaquina,
  EtapaImagen,
  Prisma,
  TipoIntervencion,
  Usuario,
} from '@prisma/client';
import { syncTrabajosDesdeDiagnosticoLegacy } from '../common/intervencion-sync';
import { toIntervencionDto, toMaquinaDto } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import {
  AsignacionDiagnosticoDto,
  FinalizarDiagnosticoDto,
  UpdateAsignacionDiagnosticoDto,
  CreateIntervencionDto,
  CreateMaquinaDto,
  RegistrarRecepcionDto,
  RegistrarTransitoDto,
  UpdateMaquinaDto,
  UpdateMaquinaEstadoDto,
  UploadImagenDto,
} from './dto/maquina.dto';

const MAX_IMAGENES_POR_ETAPA = 10;

@Injectable()
export class MaquinasService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private includeDetail() {
    return {
      proveedor: true,
      tomadaPor: true,
      creadoPor: true,
      empleadoDiag: true,
      imagenes: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
      intervenciones: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          registradoPor: true,
          responsable: true,
          aprobadoPor: true,
          finalizadoPor: true,
          avances: {
            orderBy: { registradoEn: 'asc' as const },
            include: { registradoPor: { select: { id: true, nombre: true } } },
          },
          marcasCalendario: { orderBy: { fecha: 'asc' as const } },
        },
      },
      historialEstados: {
        orderBy: { createdAt: 'desc' as const },
        include: { creadoPor: true },
      },
      pedidos: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        include: { cliente: true },
      },
    };
  }

  async findAll(estado?: EstadoMaquina) {
    const maquinas = await this.prisma.maquina.findMany({
      where: estado ? { estado } : undefined,
      include: {
        proveedor: true,
        tomadaPor: true,
        imagenes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return maquinas.map((m) => toMaquinaDto(m));
  }

  async findOne(id: string) {
    await syncTrabajosDesdeDiagnosticoLegacy(this.prisma, id);
    const maquina = await this.prisma.maquina.findUnique({
      where: { id },
      include: this.includeDetail(),
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    return toMaquinaDto(maquina);
  }

  async getHistorialEstados(id: string) {
    await this.ensureExists(id);
    const rows = await this.prisma.historialEstado.findMany({
      where: { maquinaId: id },
      include: { creadoPor: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((h) => ({
      id: h.id,
      maquinaId: h.maquinaId,
      estado: h.estado,
      anterior: h.anterior,
      motivo: h.motivo,
      creadoPor: {
        id: h.creadoPor.id,
        nombre: h.creadoPor.nombre,
        email: h.creadoPor.email,
      },
      createdAt: h.createdAt.toISOString(),
    }));
  }

  /** undefined = no cambiar; null = dejar vacío; número = guardar. */
  private precioCompraDe(valor?: string | null): Prisma.Decimal | null | undefined {
    if (valor === undefined) return undefined;
    const texto = valor?.trim() ?? '';
    if (!texto) return null;
    const monto = Number(texto);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('El precio de compra debe ser mayor a 0');
    }
    return new Prisma.Decimal(texto);
  }

  async create(dto: CreateMaquinaDto, user: Usuario) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor) throw new BadRequestException('Proveedor no encontrado');

    const precioCompra = this.precioCompraDe(dto.precioCompraUsd);

    const maquina = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maquina.create({
        data: {
          nombre: dto.nombre.trim(),
          tipo: dto.tipo?.trim() || '',
          marca: dto.marca?.trim() || '',
          modelo: dto.modelo?.trim() || '',
          anio: dto.anio ?? null,
          proveedorId: dto.proveedorId,
          descripcionLlegada: dto.descripcionLlegada,
          descripcionAcordada: dto.descripcionAcordada ?? dto.descripcionLlegada,
          precioCompraUsd: precioCompra ?? null,
          monedaCompra: dto.monedaCompra ?? 'USD',
          precioVentaUsd: dto.precioVentaUsd ? new Prisma.Decimal(dto.precioVentaUsd) : null,
          fechaCompra: dto.fechaCompra ? new Date(dto.fechaCompra) : new Date(),
          fechaLlegadaEstimada: dto.fechaLlegadaEstimada
            ? new Date(dto.fechaLlegadaEstimada)
            : undefined,
          creadoPorId: user.id,
        },
        include: { proveedor: true, creadoPor: true },
      });

      await tx.historialEstado.create({
        data: {
          maquinaId: created.id,
          estado: EstadoMaquina.COMPRADA_ITALIA,
          anterior: null,
          motivo: 'Registro inicial',
          creadoPorId: user.id,
        },
      });

      return created;
    });

    return toMaquinaDto(maquina);
  }

  async update(id: string, dto: UpdateMaquinaDto) {
    const maquina = await this.ensureExists(id);
    if (maquina.estado === EstadoMaquina.VENDIDA) {
      throw new BadRequestException('No se puede editar una máquina vendida');
    }

    if (dto.proveedorId) {
      const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
      if (!proveedor) throw new BadRequestException('Proveedor no encontrado');
    }

    const updated = await this.prisma.maquina.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        tipo: dto.tipo !== undefined ? dto.tipo.trim() : undefined,
        marca: dto.marca !== undefined ? dto.marca.trim() : undefined,
        modelo: dto.modelo !== undefined ? dto.modelo.trim() : undefined,
        anio: dto.anio,
        proveedorId: dto.proveedorId,
        descripcionLlegada: dto.descripcionLlegada,
        fechaLlegadaReal: dto.fechaLlegadaReal ? new Date(dto.fechaLlegadaReal) : undefined,
        precioCompraUsd: this.precioCompraDe(dto.precioCompraUsd),
        monedaCompra: dto.monedaCompra,
        precioVentaUsd: dto.precioVentaUsd ? new Prisma.Decimal(dto.precioVentaUsd) : undefined,
        tipoCambioUsado: dto.tipoCambioUsado ? new Prisma.Decimal(dto.tipoCambioUsado) : undefined,
        precioVentaBob: dto.precioVentaBob ? new Prisma.Decimal(dto.precioVentaBob) : undefined,
      },
      include: this.includeDetail(),
    });
    return toMaquinaDto(updated);
  }

  async liberar(id: string) {
    await this.ensureExists(id);
    await this.prisma.maquina.update({
      where: { id },
      data: { tomadaPorId: null, tomadaEn: null },
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const maquina = await this.prisma.maquina.findUnique({
      where: { id },
      include: {
        imagenes: true,
        venta: { include: { reciboVenta: true } },
        pedidos: { include: { reciboReserva: true } },
      },
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');

    await this.prisma.$transaction(async (tx) => {
      if (maquina.venta?.reciboVenta) {
        await tx.reciboVenta.delete({ where: { id: maquina.venta.reciboVenta.id } });
      }
      if (maquina.venta) {
        await tx.venta.delete({ where: { id: maquina.venta.id } });
      }
      for (const pedido of maquina.pedidos) {
        if (pedido.reciboReserva) {
          await tx.reciboReserva.delete({ where: { id: pedido.reciboReserva.id } });
        }
      }
      if (maquina.pedidos.length) {
        await tx.pedido.deleteMany({ where: { maquinaId: id } });
      }
      await tx.maquina.delete({ where: { id } });
    });

    await Promise.all(
      maquina.imagenes.flatMap((img) => [
        this.storage.deleteFile(img.url),
        this.storage.deleteFile(img.thumbnailUrl),
      ]),
    );
    if (maquina.notaAudioUrl) {
      await this.storage.deleteFile(maquina.notaAudioUrl);
    }

    return { ok: true };
  }

  async registrarTransito(id: string, dto: RegistrarTransitoDto, user: Usuario) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (
      maquina.estado !== EstadoMaquina.COMPRADA_ITALIA &&
      maquina.estado !== EstadoMaquina.RESERVADA
    ) {
      throw new BadRequestException('Solo se puede despachar desde Comprada o Reservada');
    }

    const updated = await this.changeEstado(
      maquina,
      EstadoMaquina.EN_TRANSITO,
      user.id,
      'Despacho a tránsito',
      {
        fechaDespacho: new Date(dto.fechaDespacho),
        fechaLlegadaEstimada: dto.fechaLlegadaEstimada
          ? new Date(dto.fechaLlegadaEstimada)
          : maquina.fechaLlegadaEstimada,
      },
    );
    return toMaquinaDto(updated);
  }

  async confirmarRecibida(id: string, user: Usuario, fechaLlegadaReal?: string) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_TRANSITO) {
      throw new BadRequestException('Solo se puede recibir desde En tránsito');
    }

    const updated = await this.changeEstado(
      maquina,
      EstadoMaquina.RECIBIDA,
      user.id,
      'Confirmación de recepción',
      {
        fechaLlegadaReal: fechaLlegadaReal ? new Date(fechaLlegadaReal) : new Date(),
      },
    );
    return toMaquinaDto(updated);
  }

  async registrarRecepcion(
    id: string,
    dto: RegistrarRecepcionDto,
    files: Express.Multer.File[],
    user: Usuario,
  ) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.RECIBIDA) {
      throw new BadRequestException('Complete la recepción solo cuando esté en estado Recibida');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.historialEstado.create({
        data: {
          maquinaId: id,
          estado: EstadoMaquina.EN_DIAGNOSTICO,
          anterior: maquina.estado,
          motivo: 'Recepción verificada — pendiente diagnóstico por área',
          creadoPorId: user.id,
        },
      });

      const m = await tx.maquina.update({
        where: { id },
        data: {
          descripcionLlegada: dto.descripcionLlegada,
          empleadoDiagnostico: null,
          empleadoDiagnosticoId: null,
          fechaLlegadaReal: dto.fechaLlegadaReal ? new Date(dto.fechaLlegadaReal) : maquina.fechaLlegadaReal,
          estado: EstadoMaquina.EN_DIAGNOSTICO,
        },
        include: this.includeDetail(),
      });

      await tx.intervencion.create({
        data: {
          maquinaId: id,
          tipo: TipoIntervencion.OBSERVACION_ADICIONAL,
          area: AreaIntervencion.MANTENIMIENTO_GENERAL,
          descripcion: `Recepción verificada: ${dto.descripcionLlegada}`,
          registradoPorId: user.id,
        },
      });

      return m;
    });

    if (files?.length) {
      try {
        await this.uploadImagenes(id, { etapa: EtapaImagen.LLEGADA }, files);
      } catch (err) {
        const detalle = err instanceof Error ? err.message : 'No se pudieron subir las fotos';
        throw new BadRequestException(
          `La recepción ya quedó guardada. Las fotos no se subieron: ${detalle}. Agréguelas desde la ficha de la máquina.`,
        );
      }
    }

    return toMaquinaDto(updated);
  }

  async agregarAsignacionDiagnostico(id: string, dto: AsignacionDiagnosticoDto, user: Usuario) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_DIAGNOSTICO) {
      throw new BadRequestException('Solo se pueden asignar observaciones en diagnóstico');
    }

    const existente = await this.prisma.intervencion.findFirst({
      where: {
        maquinaId: id,
        tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
        area: dto.area,
        estadoIntervencion: { not: EstadoIntervencion.CANCELADO },
      },
    });
    if (existente) {
      throw new BadRequestException('Ya hay una asignación activa en esta área. Edítala o elimínala primero.');
    }

    const emp = await this.prisma.empleado.findUnique({ where: { id: dto.responsableId } });
    if (!emp?.activo) throw new BadRequestException('Empleado responsable no válido');

    const intervencion = await this.prisma.intervencion.create({
      data: {
        maquinaId: id,
        tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
        area: dto.area,
        descripcion: dto.descripcion.trim(),
        responsableId: dto.responsableId,
        responsableNombre: `${emp.nombre} ${emp.apellido}`,
        fechaAsignacion: new Date(),
        estadoIntervencion: EstadoIntervencion.ASIGNADO,
        registradoPorId: user.id,
      },
      include: {
        registradoPor: true,
        responsable: true,
      },
    });

    return toIntervencionDto(intervencion);
  }

  async actualizarAsignacionDiagnostico(
    maquinaId: string,
    intervencionId: string,
    dto: UpdateAsignacionDiagnosticoDto,
    user: Usuario,
  ) {
    const intervencion = await this.getAsignacionDiagnosticoEditable(maquinaId, intervencionId);

    let responsableNombre = intervencion.responsableNombre;
    let responsableId = intervencion.responsableId;
    if (dto.responsableId && dto.responsableId !== intervencion.responsableId) {
      const emp = await this.prisma.empleado.findUnique({ where: { id: dto.responsableId } });
      if (!emp?.activo) throw new BadRequestException('Empleado responsable no válido');
      responsableNombre = `${emp.nombre} ${emp.apellido}`;
      responsableId = dto.responsableId;
    }

    let observaciones = intervencion.observaciones;
    if (dto.detalleAdicional?.trim()) {
      const extra = dto.detalleAdicional.trim();
      observaciones = observaciones?.trim() ? `${observaciones.trim()}\n${extra}` : extra;
    }

    const descripcion = dto.descripcion?.trim() || intervencion.descripcion;

    const updated = await this.prisma.intervencion.update({
      where: { id: intervencionId },
      data: {
        descripcion,
        observaciones,
        responsableId,
        responsableNombre,
        registradoPorId: user.id,
      },
      include: {
        registradoPor: true,
        responsable: true,
      },
    });

    await this.sincronizarTrabajoAbierto(maquinaId, intervencion.area, {
      descripcion,
      responsableId,
      responsableNombre,
    });

    return toIntervencionDto(updated);
  }

  async eliminarAsignacionDiagnostico(maquinaId: string, intervencionId: string) {
    const intervencion = await this.getAsignacionDiagnosticoEditable(maquinaId, intervencionId);

    const enCurso = await this.prisma.intervencion.findFirst({
      where: {
        maquinaId,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        area: intervencion.area,
        estadoIntervencion: {
          in: [EstadoIntervencion.EN_PROCESO, EstadoIntervencion.FINALIZADO, EstadoIntervencion.APROBADO],
        },
      },
    });
    if (enCurso && enCurso.estadoIntervencion !== EstadoIntervencion.APROBADO) {
      throw new BadRequestException(
        'Esta área ya tiene un trabajo iniciado. Espere a que termine o rechácelo en mantenimiento antes de eliminar la asignación.',
      );
    }

    await this.prisma.intervencion.update({
      where: { id: intervencionId },
      data: { estadoIntervencion: EstadoIntervencion.CANCELADO },
    });

    await this.prisma.intervencion.updateMany({
      where: {
        maquinaId,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        area: intervencion.area,
        estadoIntervencion: {
          in: [EstadoIntervencion.ASIGNADO, EstadoIntervencion.RECHAZADO],
        },
      },
      data: { estadoIntervencion: EstadoIntervencion.CANCELADO },
    });

    return { ok: true };
  }

  async finalizarDiagnostico(id: string, dto: FinalizarDiagnosticoDto, user: Usuario) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_DIAGNOSTICO) {
      throw new BadRequestException('Solo se puede finalizar diagnóstico en ese estado');
    }

    const asignaciones = await this.prisma.intervencion.findMany({
      where: {
        maquinaId: id,
        tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
        estadoIntervencion: { not: EstadoIntervencion.CANCELADO },
      },
    });

    const irMantenimiento = asignaciones.length > 0 || dto.pasarAMantenimiento === true;

    if (irMantenimiento) {
      for (const a of asignaciones) {
        const abierto = await this.prisma.intervencion.findFirst({
          where: {
            maquinaId: id,
            tipo: TipoIntervencion.TRABAJO_REALIZADO,
            area: a.area,
            estadoIntervencion: {
              in: [
                EstadoIntervencion.ASIGNADO,
                EstadoIntervencion.EN_PROCESO,
                EstadoIntervencion.RECHAZADO,
                EstadoIntervencion.FINALIZADO,
              ],
            },
          },
        });

        if (abierto) {
          if (abierto.estadoIntervencion !== EstadoIntervencion.FINALIZADO) {
            await this.prisma.intervencion.update({
              where: { id: abierto.id },
              data: {
                descripcion: a.descripcion,
                responsableId: a.responsableId,
                responsableNombre: a.responsableNombre,
              },
            });
          }
          continue;
        }

        await this.prisma.intervencion.create({
          data: {
            maquinaId: id,
            tipo: TipoIntervencion.TRABAJO_REALIZADO,
            area: a.area,
            descripcion: a.descripcion,
            observaciones: a.observaciones,
            responsableId: a.responsableId,
            responsableNombre: a.responsableNombre,
            fechaAsignacion: new Date(),
            estadoIntervencion: EstadoIntervencion.ASIGNADO,
            registradoPorId: user.id,
          },
        });
        await this.prisma.intervencion.update({
          where: { id: a.id },
          data: { estadoIntervencion: EstadoIntervencion.CANCELADO },
        });
      }

      const motivo =
        asignaciones.length > 0
          ? 'Diagnóstico completado — pasa a mantenimiento'
          : 'Diagnóstico — paso directo a mantenimiento';

      const updated = await this.changeEstado(maquina, EstadoMaquina.EN_MANTENIMIENTO, user.id, motivo);
      return toMaquinaDto(updated);
    }

    const skipMantenimiento = dto.requiereMantenimiento === false;
    if (!skipMantenimiento) {
      throw new BadRequestException(
        'Sin observaciones registradas: marque "No requiere mantenimiento" e indique el motivo',
      );
    }
    if (!dto.motivoSinMantenimiento?.trim()) {
      throw new BadRequestException('Indique por qué no requiere mantenimiento');
    }

    const updated = await this.changeEstado(
      maquina,
      EstadoMaquina.LISTA_PARA_VENTA,
      user.id,
      `Diagnóstico preventivo: ${dto.motivoSinMantenimiento.trim()}`,
    );
    return toMaquinaDto(updated);
  }

  async completarDiagnostico(id: string, dto: FinalizarDiagnosticoDto, user: Usuario) {
    return this.finalizarDiagnostico(id, dto, user);
  }

  async guardarNotaDiagnostico(id: string, descripcion: string, user: Usuario) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_DIAGNOSTICO) {
      throw new BadRequestException('Solo se guarda la nota durante el diagnóstico');
    }

    const texto = descripcion.trim();
    const existente = await this.prisma.intervencion.findFirst({
      where: {
        maquinaId: id,
        tipo: TipoIntervencion.OBSERVACION_ADICIONAL,
        estadoIntervencion: { not: EstadoIntervencion.CANCELADO },
      },
    });

    if (existente) {
      const updated = await this.prisma.intervencion.update({
        where: { id: existente.id },
        data: { descripcion: texto, registradoPorId: user.id },
        include: { registradoPor: true, responsable: true },
      });
      return toIntervencionDto(updated);
    }

    const created = await this.prisma.intervencion.create({
      data: {
        maquinaId: id,
        tipo: TipoIntervencion.OBSERVACION_ADICIONAL,
        area: AreaIntervencion.MANTENIMIENTO_GENERAL,
        descripcion: texto,
        estadoIntervencion: EstadoIntervencion.ASIGNADO,
        registradoPorId: user.id,
      },
      include: { registradoPor: true, responsable: true },
    });
    return toIntervencionDto(created);
  }

  private async getAsignacionDiagnosticoEditable(maquinaId: string, intervencionId: string) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id: maquinaId } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_DIAGNOSTICO) {
      throw new BadRequestException('Solo se editan asignaciones durante el diagnóstico');
    }

    const intervencion = await this.prisma.intervencion.findFirst({
      where: {
        id: intervencionId,
        maquinaId,
        tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
        estadoIntervencion: EstadoIntervencion.ASIGNADO,
      },
    });
    if (!intervencion) {
      throw new NotFoundException('Asignación de diagnóstico no encontrada o no editable');
    }
    return intervencion;
  }

  async omitirMantenimiento(id: string, motivo: string, user: Usuario) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_MANTENIMIENTO) {
      throw new BadRequestException('Solo se puede omitir el mantenimiento en ese estado');
    }

    const texto = motivo.trim();
    if (texto.length < 3) {
      throw new BadRequestException('Indique por qué no requiere mantenimiento');
    }

    await this.prisma.intervencion.updateMany({
      where: {
        maquinaId: id,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        estadoIntervencion: {
          in: [
            EstadoIntervencion.ASIGNADO,
            EstadoIntervencion.EN_PROCESO,
            EstadoIntervencion.RECHAZADO,
            EstadoIntervencion.FINALIZADO,
          ],
        },
      },
      data: { estadoIntervencion: EstadoIntervencion.CANCELADO },
    });

    const updated = await this.changeEstado(
      maquina,
      EstadoMaquina.LISTA_PARA_VENTA,
      user.id,
      `No requiere mantenimiento: ${texto}`,
    );
    return toMaquinaDto(updated);
  }

  async actualizarTrabajoMantenimiento(
    maquinaId: string,
    intervencionId: string,
    descripcion: string,
    user: Usuario,
  ) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id: maquinaId } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado !== EstadoMaquina.EN_MANTENIMIENTO) {
      throw new BadRequestException('Solo se editan trabajos en mantenimiento');
    }

    const intervencion = await this.prisma.intervencion.findFirst({
      where: {
        id: intervencionId,
        maquinaId,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        estadoIntervencion: {
          in: [EstadoIntervencion.ASIGNADO, EstadoIntervencion.EN_PROCESO, EstadoIntervencion.RECHAZADO],
        },
      },
      include: { registradoPor: true, responsable: true },
    });
    if (!intervencion) throw new NotFoundException('Trabajo no editable');

    const updated = await this.prisma.intervencion.update({
      where: { id: intervencionId },
      data: { descripcion: descripcion.trim(), registradoPorId: user.id },
      include: { registradoPor: true, responsable: true },
    });
    return toIntervencionDto(updated);
  }

  async uploadNotaAudio(id: string, file: Express.Multer.File) {
    await this.ensureExists(id);
    const stored = await this.storage.saveAudio(file.buffer, file.originalname);
    await this.prisma.maquina.update({
      where: { id },
      data: { notaAudioUrl: stored.url },
    });
    return { url: stored.url };
  }

  async updateEstado(id: string, dto: UpdateMaquinaEstadoDto, user: Usuario) {
    const maquina = await this.prisma.maquina.findUnique({ where: { id } });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');

    if (maquina.estado === EstadoMaquina.VENDIDA && dto.estado !== EstadoMaquina.VENDIDA) {
      throw new BadRequestException(
        'No se puede retroceder el estado de una máquina vendida. Anule la venta primero.',
      );
    }

    if (dto.estado === maquina.estado) {
      throw new BadRequestException('La máquina ya está en ese estado');
    }

    const updated = await this.changeEstado(maquina, dto.estado, user.id, dto.motivo);
    return toMaquinaDto(updated);
  }

  async uploadImagenes(id: string, dto: UploadImagenDto, files: Express.Multer.File[]) {
    await this.ensureExists(id);
    if (!files?.length) throw new BadRequestException('Al menos una imagen es requerida');
    if (files.length > MAX_IMAGENES_POR_ETAPA) {
      throw new BadRequestException(`Máximo ${MAX_IMAGENES_POR_ETAPA} imágenes por carga`);
    }

    const existentes = await this.prisma.imagenMaquina.count({
      where: { maquinaId: id, etapa: dto.etapa },
    });
    if (existentes + files.length > MAX_IMAGENES_POR_ETAPA) {
      throw new BadRequestException(
        `Máximo ${MAX_IMAGENES_POR_ETAPA} fotos por etapa (${dto.etapa}). Ya hay ${existentes}.`,
      );
    }

    const results = [];
    const base = Date.now();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let stored: { url: string; thumbnailUrl: string };
      try {
        stored = await this.storage.saveImage(file.buffer, file.originalname);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'No se pudo procesar la foto',
        );
      }
      const imagen = await this.prisma.imagenMaquina.create({
        data: {
          maquinaId: id,
          etapa: dto.etapa,
          intervencionId: dto.intervencionId ?? null,
          url: stored.url,
          thumbnailUrl: stored.thumbnailUrl,
          createdAt: new Date(base + i),
        },
      });
      results.push({
        id: imagen.id,
        maquinaId: imagen.maquinaId,
        etapa: imagen.etapa,
        url: imagen.url,
        thumbnailUrl: imagen.thumbnailUrl,
        createdAt: imagen.createdAt.toISOString(),
      });
    }
    return results;
  }

  async uploadImagen(id: string, dto: UploadImagenDto, file: Express.Multer.File) {
    const [result] = await this.uploadImagenes(id, dto, [file]);
    return result;
  }

  async deleteImagen(maquinaId: string, imagenId: string) {
    const imagen = await this.prisma.imagenMaquina.findFirst({
      where: { id: imagenId, maquinaId },
    });
    if (!imagen) throw new NotFoundException('Foto no encontrada');

    await this.prisma.imagenMaquina.delete({ where: { id: imagen.id } });
    await this.storage.deleteFile(imagen.url);
    await this.storage.deleteFile(imagen.thumbnailUrl);
    return { ok: true };
  }

  async createIntervencion(id: string, dto: CreateIntervencionDto, user: Usuario) {
    const maquina = await this.ensureExists(id);
    if (
      maquina.estado === EstadoMaquina.EN_MANTENIMIENTO &&
      dto.tipo === TipoIntervencion.TRABAJO_REALIZADO
    ) {
      throw new BadRequestException(
        'Los trabajos de mantenimiento se asignan en diagnóstico. Edite los existentes si necesita cambios.',
      );
    }

    const empleado = await this.prisma.empleado.findUnique({ where: { id: dto.responsableId } });
    if (!empleado || !empleado.activo) {
      throw new BadRequestException('Empleado no encontrado o inactivo');
    }

    const intervencion = await this.prisma.intervencion.create({
      data: {
        maquinaId: id,
        tipo: dto.tipo,
        area: dto.area,
        descripcion: dto.descripcion,
        responsableId: dto.responsableId,
        fechaAsignacion: new Date(),
        estadoIntervencion: EstadoIntervencion.ASIGNADO,
        registradoPorId: user.id,
      },
      include: {
        registradoPor: true,
        responsable: true,
      },
    });

    return toIntervencionDto(intervencion);
  }

  async getDashboardResumen() {
    const grouped = await this.prisma.maquina.groupBy({
      by: ['estado'],
      _count: { estado: true },
    });

    const porEstado = Object.values(EstadoMaquina).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoMaquina, number>,
    );

    for (const row of grouped) {
      porEstado[row.estado] = row._count.estado;
    }

    const total = Object.values(porEstado).reduce((sum, n) => sum + n, 0);
    return { total, porEstado };
  }

  private async changeEstado(
    maquina: { id: string; estado: EstadoMaquina },
    nuevoEstado: EstadoMaquina,
    userId: string,
    motivo?: string,
    extraData?: Prisma.MaquinaUpdateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.historialEstado.create({
        data: {
          maquinaId: maquina.id,
          estado: nuevoEstado,
          anterior: maquina.estado,
          motivo: motivo ?? null,
          creadoPorId: userId,
        },
      });

      return tx.maquina.update({
        where: { id: maquina.id },
        data: {
          estado: nuevoEstado,
          ...(extraData ?? {}),
        },
        include: this.includeDetail(),
      });
    });
  }

  /** Mantiene el trabajo aún no iniciado alineado con la asignación de diagnóstico. */
  private async sincronizarTrabajoAbierto(
    maquinaId: string,
    area: AreaIntervencion,
    data: {
      descripcion: string;
      responsableId: string | null;
      responsableNombre: string | null;
    },
  ) {
    await this.prisma.intervencion.updateMany({
      where: {
        maquinaId,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        area,
        estadoIntervencion: {
          in: [
            EstadoIntervencion.ASIGNADO,
            EstadoIntervencion.EN_PROCESO,
            EstadoIntervencion.RECHAZADO,
          ],
        },
      },
      data,
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.maquina.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Máquina no encontrada');
    return exists;
  }
}
