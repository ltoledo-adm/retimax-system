import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Rol, Usuario } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IntervencionesService } from './intervenciones.service';

class TomarMaquinaDto {
  @IsUUID()
  maquinaId!: string;

  @IsString()
  fechaInicio!: string;

  @IsString()
  fechaFinEstimada!: string;

  @IsString()
  @MinLength(1)
  descripcion!: string;

  @IsOptional()
  @IsString()
  precioMantenimientoEstimado?: string;
}

class IniciarTrabajoDto {
  @IsOptional()
  @IsString()
  detalleTrabajo?: string;

  @IsOptional()
  @IsString()
  fechaInicio?: string;

  @IsOptional()
  @IsString()
  fechaFinEstimada?: string;

  @IsOptional()
  @IsString()
  precioMantenimientoEstimado?: string;
}

class MarcaCalendarioDto {
  @IsIn(['PAUSA', 'RETOMA'])
  tipo!: 'PAUSA' | 'RETOMA';

  @IsString()
  fecha!: string;

  @IsString()
  @MinLength(3)
  motivo!: string;
}

class FinalizarTrabajoDto {
  @IsOptional()
  @IsString()
  detalleTrabajo?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  fechaFinalizacion?: string;

  @IsOptional()
  @IsString()
  precioMantenimientoEstimado?: string;
}

class PrecioEstimadoDto {
  @IsOptional()
  @IsString()
  precioMantenimientoEstimado?: string;
}

class RegistrarAvanceDto {
  @IsString()
  @MinLength(1)
  descripcion!: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

@Controller()
@UseGuards(RolesGuard)
export class IntervencionesController {
  constructor(private readonly intervencionesService: IntervencionesService) {}

  @Get('mis-trabajos')
  @Roles(Rol.EMPLEADO)
  misTrabajos(@CurrentUser() user: Usuario) {
    return this.intervencionesService.listMisTrabajos(user);
  }

  @Get('mis-trabajos/maquinas')
  @Roles(Rol.EMPLEADO)
  maquinas(@CurrentUser() user: Usuario, @Query('q') q?: string) {
    return this.intervencionesService.listMaquinas(user, q);
  }

  @Get('mis-trabajos/maquinas/:id')
  @Roles(Rol.EMPLEADO)
  ficha(@CurrentUser() user: Usuario, @Param('id') id: string) {
    return this.intervencionesService.fichaMaquina(user, id);
  }

  @Post('mis-trabajos/tomar')
  @Roles(Rol.EMPLEADO)
  tomar(@CurrentUser() user: Usuario, @Body() body: TomarMaquinaDto) {
    return this.intervencionesService.tomar(user, body);
  }

  @Get('intervenciones/pendientes-aprobacion')
  @Roles(Rol.ADMIN)
  pendientesAprobacion() {
    return this.intervencionesService.listPendientesAprobacion();
  }

  @Patch('intervenciones/:id/iniciar')
  @Roles(Rol.EMPLEADO)
  iniciar(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: IniciarTrabajoDto,
  ) {
    return this.intervencionesService.iniciar(id, user, body);
  }

  @Patch('intervenciones/:id/precio')
  @Roles(Rol.EMPLEADO)
  precio(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: PrecioEstimadoDto,
  ) {
    return this.intervencionesService.actualizarPrecio(id, user, body.precioMantenimientoEstimado);
  }

  @Post('intervenciones/:id/calendario')
  @Roles(Rol.EMPLEADO)
  calendario(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: MarcaCalendarioDto,
  ) {
    return this.intervencionesService.marcarCalendario(id, user, body);
  }

  @Post('intervenciones/:id/avances/:avanceId/video')
  @Roles(Rol.EMPLEADO)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  video(
    @Param('id') id: string,
    @Param('avanceId') avanceId: string,
    @CurrentUser() user: Usuario,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Adjunte un video corto, de unos 10 segundos');
    return this.intervencionesService.adjuntarVideo(id, avanceId, user, file);
  }

  @Post('intervenciones/:id/imagenes/lote')
  @Roles(Rol.EMPLEADO)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadImagenesTrabajo(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('Al menos una imagen es requerida');
    return this.intervencionesService.uploadImagenesTrabajo(id, user, files);
  }

  @Post('intervenciones/:id/avances')
  @Roles(Rol.EMPLEADO)
  registrarAvance(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: RegistrarAvanceDto,
  ) {
    return this.intervencionesService.registrarAvance(id, user, body);
  }

  @Patch('intervenciones/:id/finalizar')
  @Roles(Rol.EMPLEADO)
  finalizar(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: FinalizarTrabajoDto,
  ) {
    return this.intervencionesService.finalizar(id, user, body);
  }

  @Patch('intervenciones/:id/aprobar')
  @Roles(Rol.ADMIN)
  aprobar(@Param('id') id: string, @CurrentUser() user: Usuario) {
    return this.intervencionesService.aprobar(id, user);
  }

  @Patch('intervenciones/:id/rechazar')
  @Roles(Rol.ADMIN)
  rechazar(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: { observaciones?: string },
  ) {
    return this.intervencionesService.rechazar(id, user, body.observaciones);
  }
}
