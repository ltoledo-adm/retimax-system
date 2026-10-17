import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Rol } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateHerramientaDto, CreateVentaHerramientaDto, UpdateHerramientaDto } from './dto/herramienta.dto';
import { HerramientasService } from './herramientas.service';

@Controller()
@Roles(Rol.ADMIN)
export class HerramientasController {
  constructor(private readonly herramientasService: HerramientasService) {}

  @Get('herramientas')
  list() {
    return this.herramientasService.list();
  }

  @Post('herramientas')
  create(@Body() dto: CreateHerramientaDto) {
    return this.herramientasService.create(dto);
  }

  @Patch('herramientas/:id')
  update(@Param('id') id: string, @Body() dto: UpdateHerramientaDto) {
    return this.herramientasService.update(id, dto);
  }

  @Post('herramientas/:id/foto')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadFoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('La foto es requerida');
    return this.herramientasService.uploadFoto(id, file);
  }

  @Get('ventas-herramientas')
  listVentas() {
    return this.herramientasService.listVentas();
  }

  @Post('ventas-herramientas')
  vender(@Body() dto: CreateVentaHerramientaDto) {
    return this.herramientasService.vender(dto);
  }
}
