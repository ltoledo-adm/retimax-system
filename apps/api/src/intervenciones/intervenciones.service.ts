import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AreaIntervencion,
  EstadoAprobacion,
  EstadoIntervencion,
  EstadoMaquina,
  EtapaImagen,
  Prisma,
  Rol,
  TipoIntervencion,
  TipoMarcaCalendario,
  Usuario,
} from '@prisma/client';
import { areaPrincipal, areasForEspecialidad } from '../common/empleado-utils';
import { exigirFecha, fechaCalendario } from '../common/fechas';
import { syncTrabajosDesdeDiagnosticoLegacy } from '../common/intervencion-sync';
import { toIntervencionDto } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';

const MAX_FOTOS_TRABAJO = 10;

@Injectable()
export class IntervencionesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async listMisTrabajos(user: Usuario) {
    if (user.rol !== Rol.EMPLEADO || !user.empleadoId) {
      throw new ForbiddenException('Solo empleados pueden ver sus trabajos');
    }

    const empleado = await this.prisma.empleado.findUnique({ where: { id: user.empleadoId } });
    if (!empleado?.activo) {
      throw new ForbiddenException('Empleado inactivo');
    }

    const allowedAreas = areasForEspecialidad(empleado.especialidad);

    const legacyMaquinas = await this.prisma.intervencion.findMany({
      where: {
        responsableId: user.empleadoId,
        tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
        estadoIntervencion: EstadoIntervencion.FINALIZADO,
      },
      select: { maquinaId: true },
      distinct: ['maquinaId'],
    });
    for (const { maquinaId } of legacyMaquinas) {
      await syncTrabajosDesdeDiagnosticoLegacy(this.prisma, maquinaId);
    }

    const rows = await this.prisma.intervencion.findMany({
      where: {
        responsableId: user.empleadoId,
        area: { in: allowedAreas },
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        estadoIntervencion: { notIn: [EstadoIntervencion.CANCELADO] },
      },
      include: this.includeRelations(),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toIntervencionDto(r, { employeeView: true }));
  }

  async listMaquinas(user: Usuario, q?: string) {
    const empleadoId = await this.empleadoActivoId(user);
    const texto = q?.trim();
    const rows = await this.prisma.maquina.findMany({
      where: {
        estado: { not: EstadoMaquina.VENDIDA },
        ...(texto
          ? {
              OR: [
                { nombre: { contains: texto, mode: 'insensitive' } },
                { tipo: { contains: texto, mode: 'insensitive' } },
                { marca: { contains: texto, mode: 'insensitive' } },
                { modelo: { contains: texto, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        tomadaPor: { select: { id: true, nombre: true, apellido: true } },
        imagenes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 },
      },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((m) => this.fichaCorta(m, empleadoId));
  }

  async fichaMaquina(user: Usuario, maquinaId: string) {
    const empleadoId = await this.empleadoActivoId(user);
    const maquina = await this.prisma.maquina.findUnique({
      where: { id: maquinaId },
      include: {
        tomadaPor: { select: { id: true, nombre: true, apellido: true } },
        imagenes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!maquina || maquina.estado === EstadoMaquina.VENDIDA) {
      throw new NotFoundException('Máquina no encontrada');
    }
    const miTrabajo = await this.prisma.intervencion.findFirst({
      where: {
        maquinaId,
        responsableId: empleadoId,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        estadoIntervencion: { not: EstadoIntervencion.CANCELADO },
      },
      include: this.includeRelations(),
      orderBy: { createdAt: 'desc' },
    });
    const corta = this.fichaCorta(maquina, empleadoId);
    return {
      ...corta,
      imagenes: maquina.imagenes.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
      })),
      miTrabajo: miTrabajo ? toIntervencionDto(miTrabajo, { employeeView: true }) : null,
    };
  }

  async tomar(
    user: Usuario,
    body: {
      maquinaId: string;
      fechaInicio: string;
      fechaFinEstimada: string;
      descripcion: string;
      precioMantenimientoEstimado?: string;
    },
  ) {
    const empleado = await this.empleadoActivo(user);
    const descripcion = body.descripcion?.trim();
    if (!descripcion) throw new BadRequestException('Escriba qué va a hacer en la máquina');
    const fechaInicio = exigirFecha(body.fechaInicio);
    const fechaFinEstimada = exigirFecha(body.fechaFinEstimada);
    if (fechaFinEstimada < fechaInicio) {
      throw new BadRequestException('La fecha estimada de fin no puede ser anterior al inicio');
    }
    const precio = this.precioEstimado(body.precioMantenimientoEstimado);

    const ya = await this.prisma.intervencion.findFirst({
      where: {
        maquinaId: body.maquinaId,
        responsableId: empleado.id,
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
    });
    if (ya) {
      throw new BadRequestException('Usted ya tiene esta máquina. Ábrala en Mis trabajos.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await this.ocupar(tx, body.maquinaId, empleado.id);
      return tx.intervencion.create({
        data: {
          maquinaId: body.maquinaId,
          tipo: TipoIntervencion.TRABAJO_REALIZADO,
          area: areaPrincipal(empleado.especialidad),
          descripcion,
          responsableId: empleado.id,
          responsableNombre: `${empleado.nombre} ${empleado.apellido}`.trim(),
          estadoIntervencion: EstadoIntervencion.EN_PROCESO,
          estadoAprobacion: EstadoAprobacion.PENDIENTE,
          fechaAsignacion: new Date(),
          fechaInicio,
          fechaFinEstimada,
          precioMantenimientoEstimado: precio,
          registradoPorId: user.id,
        },
        include: this.includeRelations(),
      });
    });
    return toIntervencionDto(created, { employeeView: true });
  }

  async listPendientesAprobacion() {
    const maquinas = await this.prisma.intervencion.findMany({
      where: {
        tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
        estadoIntervencion: EstadoIntervencion.FINALIZADO,
      },
      select: { maquinaId: true },
      distinct: ['maquinaId'],
    });
    for (const { maquinaId } of maquinas) {
      await syncTrabajosDesdeDiagnosticoLegacy(this.prisma, maquinaId);
    }

    const rows = await this.prisma.intervencion.findMany({
      where: {
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        estadoIntervencion: EstadoIntervencion.FINALIZADO,
      },
      include: this.includeRelations(),
      orderBy: { fechaFinalizacion: 'desc' },
    });
    return rows.map((r) => toIntervencionDto(r));
  }

  async iniciar(
    id: string,
    user: Usuario,
    body: {
      detalleTrabajo?: string;
      fechaInicio?: string;
      fechaFinEstimada?: string;
      precioMantenimientoEstimado?: string;
    },
  ) {
    const intervencion = await this.resolveTrabajoMantenimiento(await this.getForEmployee(id, user));
    if (intervencion.estadoIntervencion !== EstadoIntervencion.ASIGNADO) {
      throw new BadRequestException('Solo se puede iniciar un trabajo asignado');
    }
    const fechaInicio = body.fechaInicio ? exigirFecha(body.fechaInicio) : new Date();
    const fechaFinEstimada = fechaCalendario(body.fechaFinEstimada);
    if (fechaFinEstimada && fechaFinEstimada < fechaInicio) {
      throw new BadRequestException('La fecha estimada de fin no puede ser anterior al inicio');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.ocupar(tx, intervencion.maquinaId, user.empleadoId!);
      return tx.intervencion.update({
        where: { id: intervencion.id },
        data: {
          estadoIntervencion: EstadoIntervencion.EN_PROCESO,
          fechaInicio,
          fechaFinEstimada,
          precioMantenimientoEstimado: this.precioEstimado(body.precioMantenimientoEstimado),
          detalleTrabajo: body.detalleTrabajo ?? intervencion.detalleTrabajo,
        },
        include: this.includeRelations(),
      });
    });
    return toIntervencionDto(updated, { employeeView: true });
  }

  async registrarAvance(
    id: string,
    user: Usuario,
    body: { descripcion: string; observaciones?: string },
  ) {
    const intervencion = await this.getForEmployee(id, user);
    if (
      intervencion.estadoIntervencion !== EstadoIntervencion.EN_PROCESO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.RECHAZADO
    ) {
      throw new BadRequestException('Inicie el trabajo antes de registrar el avance del día');
    }

    const descripcion = body.descripcion?.trim();
    if (!descripcion) throw new BadRequestException('Describa lo realizado en el día');

    await this.prisma.avanceDiario.create({
      data: {
        intervencionId: id,
        descripcion,
        observaciones: body.observaciones?.trim() || null,
        registradoEn: new Date(),
        registradoPorId: user.id,
      },
    });

    const updated = await this.prisma.intervencion.findUniqueOrThrow({
      where: { id },
      include: this.includeRelations(),
    });
    return toIntervencionDto(updated, { employeeView: true });
  }

  async marcarCalendario(
    id: string,
    user: Usuario,
    body: { tipo: string; fecha: string; motivo: string },
  ) {
    const intervencion = await this.getForEmployee(id, user);
    if (
      intervencion.estadoIntervencion !== EstadoIntervencion.EN_PROCESO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.RECHAZADO
    ) {
      throw new BadRequestException('Inicie el trabajo para marcar una pausa o una retoma');
    }
    if (body.tipo !== TipoMarcaCalendario.PAUSA && body.tipo !== TipoMarcaCalendario.RETOMA) {
      throw new BadRequestException('Indique si es una pausa o una retoma');
    }
    const motivo = body.motivo?.trim();
    if (!motivo || motivo.length < 3) {
      throw new BadRequestException('Escriba por qué se detuvo o por qué retoma');
    }
    await this.prisma.marcaCalendario.create({
      data: {
        intervencionId: intervencion.id,
        tipo: body.tipo,
        fecha: exigirFecha(body.fecha),
        motivo,
        creadoPorId: user.id,
      },
    });
    const updated = await this.prisma.intervencion.findUniqueOrThrow({
      where: { id: intervencion.id },
      include: this.includeRelations(),
    });
    return toIntervencionDto(updated, { employeeView: true });
  }

  async adjuntarVideo(id: string, avanceId: string, user: Usuario, file: Express.Multer.File) {
    const intervencion = await this.getForEmployee(id, user);
    if (
      intervencion.estadoIntervencion !== EstadoIntervencion.EN_PROCESO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.RECHAZADO
    ) {
      throw new BadRequestException('Inicie el trabajo antes de adjuntar un video');
    }
    if (!file?.mimetype?.startsWith('video/')) {
      throw new BadRequestException('Adjunte un video corto, de unos 10 segundos');
    }
    const avance = await this.prisma.avanceDiario.findFirst({
      where: { id: avanceId, intervencionId: intervencion.id },
    });
    if (!avance) throw new NotFoundException('Avance no encontrado');
    let stored: { url: string };
    try {
      stored = await this.storage.saveVideo(file.buffer, file.originalname || 'video.mp4');
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'No se pudo guardar el video');
    }
    if (avance.videoUrl) await this.storage.deleteFile(avance.videoUrl);
    await this.prisma.avanceDiario.update({
      where: { id: avance.id },
      data: { videoUrl: stored.url },
    });
    const updated = await this.prisma.intervencion.findUniqueOrThrow({
      where: { id: intervencion.id },
      include: this.includeRelations(),
    });
    return toIntervencionDto(updated, { employeeView: true });
  }

  async finalizar(
    id: string,
    user: Usuario,
    body: { detalleTrabajo?: string; observaciones?: string; fechaFinalizacion?: string },
  ) {
    const intervencion = await this.resolveTrabajoMantenimiento(await this.getForEmployee(id, user));
    if (
      intervencion.estadoIntervencion !== EstadoIntervencion.EN_PROCESO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.ASIGNADO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.RECHAZADO
    ) {
      throw new BadRequestException('El trabajo debe estar en proceso para finalizar');
    }

    const updated = await this.prisma.intervencion.update({
      where: { id: intervencion.id },
      data: {
        estadoIntervencion: EstadoIntervencion.FINALIZADO,
        estadoAprobacion: EstadoAprobacion.PENDIENTE,
        fechaFinalizacion: body.fechaFinalizacion ? exigirFecha(body.fechaFinalizacion) : new Date(),
        finalizadoPorId: user.empleadoId!,
        detalleTrabajo: body.detalleTrabajo ?? intervencion.detalleTrabajo,
        observaciones: body.observaciones,
      },
      include: this.includeRelations(),
    });
    return toIntervencionDto(updated, { employeeView: true });
  }

  async aprobar(id: string, user: Usuario) {
    const intervencion = await this.prisma.intervencion.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!intervencion) throw new NotFoundException('Intervención no encontrada');
    if (intervencion.estadoIntervencion !== EstadoIntervencion.FINALIZADO) {
      throw new BadRequestException('Solo se aprueban trabajos finalizados');
    }

    const updated = await this.prisma.intervencion.update({
      where: { id },
      data: {
        estadoIntervencion: EstadoIntervencion.APROBADO,
        estadoAprobacion: EstadoAprobacion.APROBADO,
        fechaAprobacion: new Date(),
        aprobadoPorId: user.id,
      },
      include: this.includeRelations(),
    });
    await this.soltarSiTerminada(intervencion.maquinaId);
    return toIntervencionDto(updated);
  }

  async uploadImagenesTrabajo(id: string, user: Usuario, files: Express.Multer.File[]) {
    const intervencion = await this.getForEmployee(id, user);
    if (intervencion.tipo !== TipoIntervencion.TRABAJO_REALIZADO) {
      throw new BadRequestException('Solo se pueden subir fotos a trabajos de mantenimiento');
    }
    if (
      intervencion.estadoIntervencion !== EstadoIntervencion.ASIGNADO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.EN_PROCESO &&
      intervencion.estadoIntervencion !== EstadoIntervencion.RECHAZADO
    ) {
      throw new BadRequestException('Solo puede subir fotos mientras el trabajo está activo');
    }
    if (!files?.length) throw new BadRequestException('Al menos una imagen es requerida');
    if (files.length > MAX_FOTOS_TRABAJO) {
      throw new BadRequestException(`Máximo ${MAX_FOTOS_TRABAJO} imágenes por carga`);
    }

    const existentes = await this.prisma.imagenMaquina.count({
      where: { intervencionId: id },
    });
    if (existentes + files.length > MAX_FOTOS_TRABAJO) {
      throw new BadRequestException(
        `Máximo ${MAX_FOTOS_TRABAJO} fotos por trabajo. Ya hay ${existentes}.`,
      );
    }

    const results = [];
    for (const file of files) {
      const stored = await this.storage.saveImage(file.buffer, file.originalname);
      const imagen = await this.prisma.imagenMaquina.create({
        data: {
          maquinaId: intervencion.maquinaId,
          intervencionId: id,
          etapa: EtapaImagen.OTRA,
          url: stored.url,
          thumbnailUrl: stored.thumbnailUrl,
        },
      });
      results.push({
        id: imagen.id,
        maquinaId: imagen.maquinaId,
        intervencionId: imagen.intervencionId,
        etapa: imagen.etapa,
        url: imagen.url,
        thumbnailUrl: imagen.thumbnailUrl,
        createdAt: imagen.createdAt.toISOString(),
      });
    }
    return results;
  }

  async rechazar(id: string, user: Usuario, observaciones?: string) {
    const intervencion = await this.prisma.intervencion.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!intervencion) throw new NotFoundException('Intervención no encontrada');
    if (intervencion.estadoIntervencion !== EstadoIntervencion.FINALIZADO) {
      throw new BadRequestException('Solo se rechazan trabajos finalizados');
    }

    const updated = await this.prisma.intervencion.update({
      where: { id },
      data: {
        estadoIntervencion: EstadoIntervencion.RECHAZADO,
        estadoAprobacion: EstadoAprobacion.RECHAZADO,
        observaciones: observaciones ?? intervencion.observaciones,
        aprobadoPorId: user.id,
      },
      include: this.includeRelations(),
    });
    return toIntervencionDto(updated);
  }

  /** El técnico solo ejecuta TRABAJO_REALIZADO; si quedó una fila vieja de diagnóstico, redirige al trabajo real. */
  private async resolveTrabajoMantenimiento(intervencion: {
    id: string;
    maquinaId: string;
    tipo: TipoIntervencion;
    area: AreaIntervencion;
    responsableId: string | null;
    estadoIntervencion: EstadoIntervencion;
    detalleTrabajo: string | null;
  }) {
    if (intervencion.tipo === TipoIntervencion.TRABAJO_REALIZADO) {
      return intervencion;
    }
    if (intervencion.tipo !== TipoIntervencion.DIAGNOSTICO_INICIAL) {
      throw new BadRequestException('Esta intervención no corresponde a un trabajo de mantenimiento');
    }

    const trabajo = await this.prisma.intervencion.findFirst({
      where: {
        maquinaId: intervencion.maquinaId,
        area: intervencion.area,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        responsableId: intervencion.responsableId,
        estadoIntervencion: {
          notIn: [EstadoIntervencion.CANCELADO, EstadoIntervencion.APROBADO],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!trabajo) {
      throw new BadRequestException(
        'La máquina aún no pasó a mantenimiento con este trabajo. Avise al administrador.',
      );
    }
    return trabajo;
  }

  private async getForEmployee(id: string, user: Usuario) {
    if (user.rol !== Rol.EMPLEADO || !user.empleadoId) {
      throw new ForbiddenException('Acceso denegado');
    }

    const empleado = await this.prisma.empleado.findUnique({ where: { id: user.empleadoId } });
    if (!empleado?.activo) throw new ForbiddenException('Empleado inactivo');

    const intervencion = await this.prisma.intervencion.findUnique({ where: { id } });
    if (!intervencion) throw new NotFoundException('Intervención no encontrada');
    if (intervencion.responsableId !== user.empleadoId) {
      throw new ForbiddenException('Este trabajo no está asignado a usted');
    }

    const allowedAreas = areasForEspecialidad(empleado.especialidad);
    if (!allowedAreas.includes(intervencion.area)) {
      throw new ForbiddenException('No tiene acceso a trabajos de esta área');
    }

    return intervencion;
  }

  private includeRelations() {
    return {
      maquina: { include: { proveedor: true } },
      responsable: true,
      finalizadoPor: true,
      aprobadoPor: true,
      registradoPor: true,
      avances: {
        orderBy: { registradoEn: 'asc' as const },
        include: { registradoPor: { select: { id: true, nombre: true } } },
      },
      marcasCalendario: { orderBy: { fecha: 'asc' as const } },
    } as const;
  }

  private async empleadoActivo(user: Usuario) {
    if (user.rol !== Rol.EMPLEADO || !user.empleadoId) {
      throw new ForbiddenException('Solo empleados pueden ver las máquinas');
    }
    const empleado = await this.prisma.empleado.findUnique({ where: { id: user.empleadoId } });
    if (!empleado?.activo) throw new ForbiddenException('Empleado inactivo');
    return empleado;
  }

  private async empleadoActivoId(user: Usuario) {
    const empleado = await this.empleadoActivo(user);
    return empleado.id;
  }

  private fichaCorta(
    maquina: {
      id: string;
      nombre: string;
      tipo: string;
      marca: string;
      modelo: string;
      estado: EstadoMaquina;
      tomadaPorId: string | null;
      imagenes?: { thumbnailUrl: string }[];
      tomadaPor: { id: string; nombre: string; apellido: string } | null;
    },
    empleadoId: string,
  ) {
    const mia = maquina.tomadaPorId === empleadoId;
    const tomada = Boolean(maquina.tomadaPorId);
    const nombre = maquina.tomadaPor
      ? `${maquina.tomadaPor.nombre} ${maquina.tomadaPor.apellido}`.trim()
      : null;
    return {
      id: maquina.id,
      nombre: maquina.nombre,
      tipo: maquina.tipo,
      marca: maquina.marca,
      modelo: maquina.modelo,
      estado: maquina.estado,
      thumbnailUrl: maquina.imagenes?.[0]?.thumbnailUrl ?? null,
      tomadaPor: maquina.tomadaPor ? { id: maquina.tomadaPor.id, nombre } : null,
      esMia: mia,
      puedoTomar: !tomada || mia,
      motivoBloqueo:
        tomada && !mia ? `Esta máquina ya la está trabajando ${nombre}.` : null,
    };
  }

  private precioEstimado(valor?: string | null) {
    const texto = valor?.trim() ?? '';
    if (!texto) return undefined;
    const monto = Number(texto);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('El precio estimado debe ser mayor a 0');
    }
    return new Prisma.Decimal(texto);
  }

  private async ocupar(
    tx: Prisma.TransactionClient,
    maquinaId: string,
    empleadoId: string,
  ) {
    const maquina = await tx.maquina.findUnique({
      where: { id: maquinaId },
      include: { tomadaPor: { select: { nombre: true, apellido: true } } },
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    if (maquina.estado === EstadoMaquina.VENDIDA) {
      throw new BadRequestException('Esta máquina ya está vendida');
    }
    if (maquina.tomadaPorId && maquina.tomadaPorId !== empleadoId) {
      const nombre = maquina.tomadaPor
        ? `${maquina.tomadaPor.nombre} ${maquina.tomadaPor.apellido}`.trim()
        : 'otro empleado';
      throw new BadRequestException(
        `Esta máquina ya la está trabajando ${nombre}. Otro empleado no puede tomarla.`,
      );
    }
    if (!maquina.tomadaPorId) {
      const claimed = await tx.maquina.updateMany({
        where: { id: maquinaId, tomadaPorId: null },
        data: { tomadaPorId: empleadoId, tomadaEn: new Date() },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Otro empleado acaba de tomar esta máquina.');
      }
    }
  }

  private async soltarSiTerminada(maquinaId: string) {
    const abiertas = await this.prisma.intervencion.count({
      where: {
        maquinaId,
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
    });
    if (abiertas === 0) {
      await this.prisma.maquina.update({
        where: { id: maquinaId },
        data: { tomadaPorId: null, tomadaEn: null },
      });
    }
  }
}
