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
      creadoPor: true,
      empleadoDiag: true,
      imagenes: { orderBy: { createdAt: 'desc' as const } },
      intervenciones: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          registradoPor: true,
          responsable: true,
          aprobadoPor: true,
          finalizadoPor: true,
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
        imagenes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return maquinas.map((m) => toMaquinaDto(m));
  }

  async findOne(id: string) {
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

  async create(dto: CreateMaquinaDto, user: Usuario) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor) throw new BadRequestException('Proveedor no encontrado');

    const maquina = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maquina.create({
        data: {
          nombre: dto.nombre.trim(),
          tipo: dto.tipo?.trim() || '',
          marca: dto.marca,
          modelo: dto.modelo,
          anio: dto.anio,
          proveedorId: dto.proveedorId,
          descripcionLlegada: dto.descripcionLlegada,
          descripcionAcordada: dto.descripcionAcordada ?? dto.descripcionLlegada,
          fechaCompra: dto.fechaCompra ? new Date(dto.fechaCompra) : undefined,
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
        tipo: dto.tipo,
        marca: dto.marca,
        modelo: dto.modelo,
        anio: dto.anio,
        proveedorId: dto.proveedorId,
        descripcionLlegada: dto.descripcionLlegada,
        fechaLlegadaReal: dto.fechaLlegadaReal ? new Date(dto.fechaLlegadaReal) : undefined,
        precioCompraUsd: dto.precioCompraUsd ? new Prisma.Decimal(dto.precioCompraUsd) : undefined,
        precioVentaUsd: dto.precioVentaUsd ? new Prisma.Decimal(dto.precioVentaUsd) : undefined,
        tipoCambioUsado: dto.tipoCambioUsado ? new Prisma.Decimal(dto.tipoCambioUsado) : undefined,
        precioVentaBob: dto.precioVentaBob ? new Prisma.Decimal(dto.precioVentaBob) : undefined,
      },
      include: this.includeDetail(),
    });
    return toMaquinaDto(updated);
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

    if (files?.length) {
      await this.uploadImagenes(id, { etapa: EtapaImagen.LLEGADA }, files);
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
    if (dto.responsableId && dto.responsableId !== intervencion.responsableId) {
      const emp = await this.prisma.empleado.findUnique({ where: { id: dto.responsableId } });
      if (!emp?.activo) throw new BadRequestException('Empleado responsable no válido');
      responsableNombre = `${emp.nombre} ${emp.apellido}`;
    }

    const updated = await this.prisma.intervencion.update({
      where: { id: intervencionId },
      data: {
        descripcion: dto.descripcion?.trim(),
        responsableId: dto.responsableId,
        responsableNombre,
        registradoPorId: user.id,
      },
      include: {
        registradoPor: true,
        responsable: true,
      },
    });

    return toIntervencionDto(updated);
  }

  async eliminarAsignacionDiagnostico(maquinaId: string, intervencionId: string) {
    await this.getAsignacionDiagnosticoEditable(maquinaId, intervencionId);
    await this.prisma.intervencion.update({
      where: { id: intervencionId },
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

    if (asignaciones.length > 0) {
      for (const a of asignaciones) {
        await this.prisma.intervencion.create({
          data: {
            maquinaId: id,
            tipo: TipoIntervencion.TRABAJO_REALIZADO,
            area: a.area,
            descripcion: `Mantenimiento según diagnóstico (${a.area}): ${a.descripcion}`,
            responsableId: a.responsableId,
            responsableNombre: a.responsableNombre,
            fechaAsignacion: new Date(),
            estadoIntervencion: EstadoIntervencion.ASIGNADO,
            registradoPorId: user.id,
          },
        });
      }

      const updated = await this.changeEstado(
        maquina,
        EstadoMaquina.EN_MANTENIMIENTO,
        user.id,
        'Diagnóstico completado — requiere mantenimiento',
      );
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
    for (const file of files) {
      const stored = await this.storage.saveImage(file.buffer, file.originalname);
      const imagen = await this.prisma.imagenMaquina.create({
        data: {
          maquinaId: id,
          etapa: dto.etapa,
          url: stored.url,
          thumbnailUrl: stored.thumbnailUrl,
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

  private async ensureExists(id: string) {
    const exists = await this.prisma.maquina.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Máquina no encontrada');
    return exists;
  }
}
