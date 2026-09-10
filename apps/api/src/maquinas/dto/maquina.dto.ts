import {
  IsBoolean,
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
} from 'class-validator';
import { AreaIntervencion, EstadoMaquina, EtapaImagen, TipoIntervencion } from '@prisma/client';

export class CreateMaquinaDto {
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

  @IsUUID()
  proveedorId!: string;

  @IsOptional()
  @IsString()
  descripcionLlegada?: string;

  @IsOptional()
  @IsString()
  descripcionAcordada?: string;

  @IsOptional()
  @IsDateString()
  fechaCompra?: string;

  @IsOptional()
  @IsDateString()
  fechaLlegadaEstimada?: string;
}

export class UpdateMaquinaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  marca?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  modelo?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  anio?: number;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @IsOptional()
  @IsString()
  descripcionLlegada?: string;

  @IsOptional()
  @IsDateString()
  fechaLlegadaReal?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioCompraUsd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioVentaUsd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  tipoCambioUsado?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioVentaBob?: string;
}

export class UpdateMaquinaEstadoDto {
  @IsEnum(EstadoMaquina)
  estado!: EstadoMaquina;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class UploadImagenDto {
  @IsEnum(EtapaImagen)
  etapa!: EtapaImagen;
}

export class RegistrarTransitoDto {
  @IsDateString()
  fechaDespacho!: string;

  @IsOptional()
  @IsDateString()
  fechaLlegadaEstimada?: string;
}

export class RegistrarRecepcionDto {
  @IsString()
  @MinLength(1)
  descripcionLlegada!: string;

  @IsOptional()
  @IsDateString()
  fechaLlegadaReal?: string;
}

export class AsignacionDiagnosticoDto {
  @IsEnum(AreaIntervencion)
  area!: AreaIntervencion;

  @IsString()
  @MinLength(1)
  descripcion!: string;

  @IsUUID()
  responsableId!: string;
}

export class UpdateAsignacionDiagnosticoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  descripcion?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class FinalizarDiagnosticoDto {
  @IsOptional()
  @IsBoolean()
  requiereMantenimiento?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  motivoSinMantenimiento?: string;
}

/** @deprecated usar asignaciones incrementales + finalizar */
export class CompletarDiagnosticoDto extends FinalizarDiagnosticoDto {}

export class CreateIntervencionDto {
  @IsEnum(TipoIntervencion)
  tipo!: TipoIntervencion;

  @IsEnum(AreaIntervencion)
  area!: AreaIntervencion;

  @IsString()
  @MinLength(1)
  descripcion!: string;

  @IsUUID()
  responsableId!: string;
}
