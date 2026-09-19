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
  EtapaImagen,
  Rol,
  TipoIntervencion,
  Usuario,
} from '@prisma/client';
import { areasForEspecialidad } from '../common/empleado-utils';
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

  async iniciar(id: string, user: Usuario, detalleTrabajo?: string) {
    const intervencion = await this.resolveTrabajoMantenimiento(await this.getForEmployee(id, user));
    if (intervencion.estadoIntervencion !== EstadoIntervencion.ASIGNADO) {
      throw new BadRequestException('Solo se puede iniciar un trabajo asignado');
    }

    const updated = await this.prisma.intervencion.update({
      where: { id: intervencion.id },
      data: {
        estadoIntervencion: EstadoIntervencion.EN_PROCESO,
        fechaInicio: new Date(),
        detalleTrabajo: detalleTrabajo ?? intervencion.detalleTrabajo,
      },
      include: this.includeRelations(),
    });
    return toIntervencionDto(updated, { employeeView: true });
  }

  async finalizar(
    id: string,
    user: Usuario,
    body: { detalleTrabajo?: string; observaciones?: string },
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
        fechaFinalizacion: new Date(),
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
    } as const;
  }
}
