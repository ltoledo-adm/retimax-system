import { Controller, Get, Query } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportesService } from './reportes.service';

@Controller('reportes')
@Roles(Rol.ADMIN)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen')
  getResumen() {
    return this.reportesService.getResumen();
  }

  @Get('trabajos')
  getTrabajos() {
    return this.reportesService.getTrabajos();
  }

  @Get('semana')
  getSemana(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportesService.resumenSemana(desde, hasta);
  }

  @Get('herramientas')
  getHerramientas(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportesService.getHerramientas(desde, hasta);
  }
}
