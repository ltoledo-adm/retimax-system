import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Rol, Usuario } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IntervencionesService } from './intervenciones.service';

@Controller()
@UseGuards(RolesGuard)
export class IntervencionesController {
  constructor(private readonly intervencionesService: IntervencionesService) {}

  @Get('mis-trabajos')
  @Roles(Rol.EMPLEADO)
  misTrabajos(@CurrentUser() user: Usuario) {
    return this.intervencionesService.listMisTrabajos(user);
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
    @Body() body: { detalleTrabajo?: string },
  ) {
    return this.intervencionesService.iniciar(id, user, body.detalleTrabajo);
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

  @Patch('intervenciones/:id/finalizar')
  @Roles(Rol.EMPLEADO)
  finalizar(
    @Param('id') id: string,
    @CurrentUser() user: Usuario,
    @Body() body: { detalleTrabajo?: string; observaciones?: string },
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
