import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateClienteDto, CreateProveedorDto, UpdateClienteDto, UpdateProveedorDto } from './dto/catalogo.dto';
import { CatalogoService } from './catalogo.service';

@Controller()
@Roles(Rol.ADMIN)
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Get('proveedores')
  listProveedores() {
    return this.catalogoService.listProveedores();
  }

  @Post('proveedores')
  createProveedor(@Body() dto: CreateProveedorDto) {
    return this.catalogoService.createProveedor(dto);
  }

  @Patch('proveedores/:id')
  updateProveedor(@Param('id') id: string, @Body() dto: UpdateProveedorDto) {
    return this.catalogoService.updateProveedor(id, dto);
  }

  @Delete('proveedores/:id')
  deleteProveedor(@Param('id') id: string) {
    return this.catalogoService.deleteProveedor(id);
  }

  @Get('clientes')
  listClientes() {
    return this.catalogoService.listClientes();
  }

  @Post('clientes')
  createCliente(@Body() dto: CreateClienteDto) {
    return this.catalogoService.createCliente(dto);
  }

  @Patch('clientes/:id')
  updateCliente(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.catalogoService.updateCliente(id, dto);
  }

  @Delete('clientes/:id')
  deleteCliente(@Param('id') id: string) {
    return this.catalogoService.deleteCliente(id);
  }
}
