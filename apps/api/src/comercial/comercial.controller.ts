import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Rol, Usuario } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ComercialService } from './comercial.service';
import { CreatePedidoDto, CreateVentaDto, UpdatePedidoDto, UpdatePedidoEstadoDto, UpdateVentaDto } from './dto/comercial.dto';

@Controller()
@Roles(Rol.ADMIN)
export class ComercialController {
  constructor(private readonly comercialService: ComercialService) {}

  @Get('pedidos')
  listPedidos() {
    return this.comercialService.listPedidos();
  }

  @Post('pedidos')
  createPedido(@Body() dto: CreatePedidoDto, @CurrentUser() user: Usuario) {
    return this.comercialService.createPedido(dto, user.id);
  }

  @Patch('pedidos/:id/estado')
  updatePedidoEstado(@Param('id') id: string, @Body() dto: UpdatePedidoEstadoDto) {
    return this.comercialService.updatePedidoEstado(id, dto);
  }

  @Patch('pedidos/:id')
  updatePedido(@Param('id') id: string, @Body() dto: UpdatePedidoDto) {
    return this.comercialService.updatePedido(id, dto);
  }

  @Get('ventas')
  listVentas() {
    return this.comercialService.listVentas();
  }

  @Post('ventas')
  createVenta(@Body() dto: CreateVentaDto) {
    return this.comercialService.createVenta(dto);
  }

  @Patch('ventas/:id')
  updateVenta(@Param('id') id: string, @Body() dto: UpdateVentaDto) {
    return this.comercialService.updateVenta(id, dto);
  }

  @Get('ventas/:id/recibo')
  getReciboVenta(@Param('id') id: string) {
    return this.comercialService.getReciboVenta(id);
  }

  @Get('pedidos/:id/recibo')
  getReciboReserva(@Param('id') id: string) {
    return this.comercialService.getReciboReserva(id);
  }
}
