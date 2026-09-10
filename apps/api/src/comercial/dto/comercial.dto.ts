import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EstadoPedido } from '@prisma/client';

export class NuevaMaquinaReservaDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsString()
  @MinLength(1)
  marca!: string;

  @IsString()
  @MinLength(1)
  modelo!: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  anio!: number;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;
}

export class CreatePedidoDto {
  @IsUUID()
  clienteId!: string;

  @IsOptional()
  @IsUUID()
  maquinaId?: string;

  @IsOptional()
  @IsString()
  descripcionReferencia?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  anticipoUsd!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  saldoUsd!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  totalUsd!: string;

  @IsOptional()
  @IsDateString()
  fechaEntregaEstimada?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NuevaMaquinaReservaDto)
  nuevaMaquina?: NuevaMaquinaReservaDto;
}

export class UpdatePedidoEstadoDto {
  @IsEnum(EstadoPedido)
  estado!: EstadoPedido;
}

export class UpdatePedidoDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  maquinaId?: string;

  @IsOptional()
  @IsString()
  descripcionReferencia?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  anticipoUsd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  saldoUsd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  totalUsd?: string;

  @IsOptional()
  @IsDateString()
  fechaEntregaEstimada?: string;
}

export class UpdateVentaDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioFinalUsd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioFinalBob?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  tipoCambio?: string;

  @IsOptional()
  @IsDateString()
  fechaEntrega?: string;
}

export class CreateVentaDto {
  @IsUUID()
  maquinaId!: string;

  @IsUUID()
  clienteId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioFinalUsd!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioFinalBob!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  tipoCambio!: string;

  @IsDateString()
  fechaEntrega!: string;
}
