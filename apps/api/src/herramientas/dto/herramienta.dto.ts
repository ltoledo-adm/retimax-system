import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHerramientaDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioCompraUsd!: string;

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsString()
  dimensiones?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  cantidad?: number;
}

export class UpdateHerramientaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioCompraUsd?: string;

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsString()
  dimensiones?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  cantidad?: number;
}

export class CreateVentaHerramientaDto {
  @IsUUID()
  herramientaId!: string;

  @IsUUID()
  clienteId!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  cantidad!: number;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioUnitarioUsd!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  tipoCambio!: string;

  @IsDateString()
  fechaEntrega!: string;
}
