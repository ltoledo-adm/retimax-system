import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, Rol } from '@prisma/client';
import { normalizeUsername, suggestUsernameFromEmpleado } from '../common/empleado-utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpleadoDto, UpdateEmpleadoDto } from './dto/empleado.dto';

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(emp: {
    id: string;
    nombre: string;
    apellido: string;
    telefono: string | null;
    email: string;
    carnet: string | null;
    especialidad: string;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
    usuario?: { id: string; username: string; activo: boolean } | null;
  }) {
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido,
      nombreCompleto: `${emp.nombre} ${emp.apellido}`,
      telefono: emp.telefono,
      email: emp.email,
      carnet: emp.carnet,
      username: emp.usuario?.username ?? null,
      especialidad: emp.especialidad,
      activo: emp.activo,
      usuarioId: emp.usuario?.id ?? null,
      createdAt: emp.createdAt.toISOString(),
      updatedAt: emp.updatedAt.toISOString(),
    };
  }

  private async ensureUniqueUsername(username: string, excludeUserId?: string) {
    const existing = await this.prisma.usuario.findUnique({ where: { username } });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }
  }

  async findAll(includeInactive = false) {
    const rows = await this.prisma.empleado.findMany({
      where: includeInactive ? undefined : { activo: true },
      include: { usuario: { select: { id: true, username: true, activo: true } } },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
    return rows.map((e) => this.toDto(e));
  }

  async findOne(id: string) {
    const emp = await this.prisma.empleado.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, username: true, activo: true } } },
    });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    return this.toDto(emp);
  }

  async create(dto: CreateEmpleadoDto) {
    const exists = await this.prisma.empleado.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Ya existe un empleado con ese email');

    if (dto.carnet) {
      const carnetDup = await this.prisma.empleado.findUnique({ where: { carnet: dto.carnet.trim() } });
      if (carnetDup) throw new ConflictException('Ya existe un empleado con ese carnet');
    }

    const username = normalizeUsername(
      dto.username ?? suggestUsernameFromEmpleado(dto.carnet, dto.nombre, dto.apellido),
    );
    await this.ensureUniqueUsername(username);

    const userExists = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (userExists) throw new ConflictException('Ya existe un usuario con ese email');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const emp = await this.prisma.$transaction(async (tx) => {
      const created = await tx.empleado.create({
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          email: dto.email,
          telefono: dto.telefono,
          carnet: dto.carnet?.trim() || null,
          especialidad: dto.especialidad,
        },
      });

      await tx.usuario.create({
        data: {
          nombre: `${dto.nombre} ${dto.apellido}`,
          username,
          email: dto.email,
          passwordHash,
          rol: Rol.EMPLEADO,
          empleadoId: created.id,
        },
      });

      return tx.empleado.findUniqueOrThrow({
        where: { id: created.id },
        include: { usuario: { select: { id: true, username: true, activo: true } } },
      });
    });

    return this.toDto(emp);
  }

  async update(id: string, dto: UpdateEmpleadoDto) {
    const emp = await this.prisma.empleado.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!emp) throw new NotFoundException('Empleado no encontrado');

    if (dto.email && dto.email !== emp.email) {
      const dup = await this.prisma.empleado.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (dup) throw new ConflictException('Email ya en uso');
    }

    if (dto.carnet && dto.carnet !== emp.carnet) {
      const carnetDup = await this.prisma.empleado.findFirst({
        where: { carnet: dto.carnet.trim(), id: { not: id } },
      });
      if (carnetDup) throw new ConflictException('Carnet ya en uso');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const e = await tx.empleado.update({
        where: { id },
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          email: dto.email,
          telefono: dto.telefono,
          carnet: dto.carnet !== undefined ? dto.carnet?.trim() || null : undefined,
          especialidad: dto.especialidad,
          activo: dto.activo,
        },
        include: { usuario: { select: { id: true, username: true, activo: true } } },
      });

      if (emp.usuario) {
        await tx.usuario.update({
          where: { id: emp.usuario.id },
          data: {
            nombre: dto.nombre && dto.apellido ? `${dto.nombre} ${dto.apellido}` : undefined,
            email: dto.email,
            activo: dto.activo,
            ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
          },
        });
      }

      return e;
    });

    return this.toDto(updated);
  }

  async remove(id: string) {
    const emp = await this.prisma.empleado.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!emp) throw new NotFoundException('Empleado no encontrado');

    const nombre = `${emp.nombre} ${emp.apellido}`.trim();

    try {
      await this.prisma.$transaction(async (tx) => {
      await tx.maquina.updateMany({
        where: { empleadoDiagnosticoId: id },
        data: { empleadoDiagnosticoId: null },
      });
      await tx.intervencion.updateMany({
        where: {
          responsableId: id,
          OR: [{ responsableNombre: null }, { responsableNombre: '' }],
        },
        data: { responsableNombre: nombre },
      });
      await tx.intervencion.updateMany({
        where: { responsableId: id },
        data: { responsableId: null },
      });
      await tx.intervencion.updateMany({
        where: { finalizadoPorId: id },
        data: { finalizadoPorId: null },
      });

      if (emp.usuario) {
        const userId = emp.usuario.id;
        const [maquinas, intervenciones, historial, avances, aprobaciones] = await Promise.all([
          tx.maquina.count({ where: { creadoPorId: userId } }),
          tx.intervencion.count({ where: { registradoPorId: userId } }),
          tx.historialEstado.count({ where: { creadoPorId: userId } }),
          tx.avanceDiario.count({ where: { registradoPorId: userId } }),
          tx.intervencion.count({ where: { aprobadoPorId: userId } }),
        ]);

        if (maquinas + intervenciones + historial + avances + aprobaciones > 0) {
          await tx.empleado.update({ where: { id }, data: { activo: false } });
          await tx.usuario.update({ where: { id: userId }, data: { activo: false } });
          return;
        }

        await tx.refreshToken.deleteMany({ where: { usuarioId: userId } });
        await tx.usuario.delete({ where: { id: userId } });
      }

      await tx.empleado.delete({ where: { id } });
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        await this.prisma.$transaction(async (tx) => {
          await tx.empleado.update({ where: { id }, data: { activo: false } });
          if (emp.usuario) {
            await tx.usuario.update({ where: { id: emp.usuario.id }, data: { activo: false } });
          }
        });
        return { ok: true };
      }
      throw error;
    }

    return { ok: true };
  }
}
