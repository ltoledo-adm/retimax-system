export enum Rol {
  ADMIN = 'ADMIN',
  EMPLEADO = 'EMPLEADO',
}

export enum Especialidad {
  MECANICO = 'MECANICO',
  ELECTRICO = 'ELECTRICO',
  PINTOR = 'PINTOR',
  MANTENIMIENTO_GENERAL = 'MANTENIMIENTO_GENERAL',
  OTRO = 'OTRO',
}

export enum EstadoIntervencion {
  ASIGNADO = 'ASIGNADO',
  EN_PROCESO = 'EN_PROCESO',
  FINALIZADO = 'FINALIZADO',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  CANCELADO = 'CANCELADO',
}

export enum EstadoAprobacion {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum EstadoMaquina {
  COMPRADA_ITALIA = 'COMPRADA_ITALIA',
  EN_TRANSITO = 'EN_TRANSITO',
  RECIBIDA = 'RECIBIDA',
  EN_DIAGNOSTICO = 'EN_DIAGNOSTICO',
  EN_MANTENIMIENTO = 'EN_MANTENIMIENTO',
  LISTA_PARA_VENTA = 'LISTA_PARA_VENTA',
  RESERVADA = 'RESERVADA',
  VENDIDA = 'VENDIDA',
}

export enum EtapaImagen {
  EMBARQUE = 'EMBARQUE',
  LLEGADA = 'LLEGADA',
  OTRA = 'OTRA',
}

export enum TipoIntervencion {
  DIAGNOSTICO_INICIAL = 'DIAGNOSTICO_INICIAL',
  TRABAJO_REALIZADO = 'TRABAJO_REALIZADO',
  OBSERVACION_ADICIONAL = 'OBSERVACION_ADICIONAL',
}

export enum AreaIntervencion {
  MECANICA = 'MECANICA',
  ELECTRICA = 'ELECTRICA',
  PINTADO = 'PINTADO',
  MANTENIMIENTO_GENERAL = 'MANTENIMIENTO_GENERAL',
}

export enum EstadoPedido {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export interface UsuarioDto {
  id: string;
  nombre: string;
  username: string;
  email: string;
  rol: Rol;
  activo: boolean;
  empleadoId?: string | null;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  usuario: UsuarioDto;
}

export interface EmpleadoDto {
  id: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono?: string | null;
  email: string;
  carnet?: string | null;
  username?: string | null;
  especialidad: Especialidad;
  activo: boolean;
  usuarioId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProveedorDto {
  id: string;
  nombre: string;
  createdAt: string;
}

export interface ClienteDto {
  id: string;
  nombre: string;
  nitCi?: string | null;
  telefono?: string | null;
  notas?: string | null;
  createdAt: string;
}

export interface ImagenMaquinaDto {
  id: string;
  maquinaId: string;
  etapa: EtapaImagen;
  url: string;
  thumbnailUrl: string;
  createdAt: string;
}

export interface IntervencionDto {
  id: string;
  maquinaId: string;
  maquina?: {
    id: string;
    nombre: string;
    tipo: string;
    marca?: string;
    modelo?: string;
    estado: string;
    proveedor?: string;
  };
  tipo: TipoIntervencion;
  area: AreaIntervencion;
  descripcion: string;
  responsableId?: string | null;
  responsableNombre?: string | null;
  responsable?: EmpleadoDto | null;
  estadoIntervencion?: EstadoIntervencion;
  detalleTrabajo?: string | null;
  observaciones?: string | null;
  fechaAsignacion?: string | null;
  fechaInicio?: string | null;
  fechaFinalizacion?: string | null;
  fechaAprobacion?: string | null;
  estadoAprobacion?: EstadoAprobacion;
  registradoPor: UsuarioDto;
  aprobadoPor?: UsuarioDto | null;
  finalizadoPor?: { id: string; nombre: string } | null;
  createdAt: string;
}

export interface HistorialEstadoDto {
  id: string;
  maquinaId: string;
  estado: EstadoMaquina;
  anterior?: EstadoMaquina | null;
  motivo?: string | null;
  creadoPor: UsuarioDto;
  createdAt: string;
}

export interface PedidoReservaResumenMaquinaDto {
  id: string;
  clienteNombre: string;
  anticipoUsd: string;
  saldoUsd: string;
  totalUsd: string;
}

export interface MaquinaDto {
  id: string;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio?: number | null;
  esReserva?: boolean;
  pedidoReserva?: PedidoReservaResumenMaquinaDto | null;
  proveedorId: string;
  proveedor?: ProveedorDto;
  estado: EstadoMaquina;
  descripcionLlegada?: string | null;
  descripcionAcordada?: string | null;
  notaAudioUrl?: string | null;
  fechaDespacho?: string | null;
  empleadoDiagnostico?: string | null;
  empleadoDiagnosticoId?: string | null;
  empleadoDiag?: { id: string; nombreCompleto: string; especialidad: string } | null;
  precioCompraUsd?: string | null;
  precioVentaUsd?: string | null;
  tipoCambioUsado?: string | null;
  precioVentaBob?: string | null;
  fechaCompra?: string | null;
  fechaLlegadaEstimada?: string | null;
  fechaLlegadaReal?: string | null;
  creadoPor?: UsuarioDto;
  imagenes?: ImagenMaquinaDto[];
  intervenciones?: IntervencionDto[];
  historialEstados?: HistorialEstadoDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ReciboReservaResumenDto {
  id: string;
  numero: string;
  fechaEmision: string;
  vigenciaDias: number;
}

export interface ReciboVentaResumenDto {
  id: string;
  numero: string;
  fechaEmision: string;
}

export interface PedidoDto {
  id: string;
  clienteId: string;
  cliente?: ClienteDto;
  maquinaId?: string | null;
  maquina?: MaquinaDto | null;
  descripcionReferencia?: string | null;
  fotoReferenciaUrl?: string | null;
  anticipoUsd: string;
  saldoUsd: string;
  totalUsd: string;
  fechaEntregaEstimada?: string | null;
  estado: EstadoPedido;
  reciboReserva?: ReciboReservaResumenDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface VentaDto {
  id: string;
  maquinaId: string;
  maquina?: MaquinaDto;
  clienteId: string;
  cliente?: ClienteDto;
  precioFinalUsd: string;
  precioFinalBob: string;
  tipoCambio: string;
  fechaEntrega: string;
  reciboVenta?: ReciboVentaResumenDto | null;
  createdAt: string;
}

export interface ReciboVentaDto {
  id: string;
  numero: string;
  ventaId: string;
  fechaEmision: string;
  venta?: {
    id: string;
    precioFinalUsd: string;
    precioFinalBob: string;
    tipoCambio: string;
    fechaEntrega: string;
    cliente: { nombre: string; telefono?: string | null };
    maquina: { nombre: string; tipo: string; proveedor?: string };
  };
}

export interface ReciboReservaDto {
  id: string;
  numero: string;
  pedidoId: string;
  fechaEmision: string;
  vigenciaDias: number;
  pedido?: {
    id: string;
    anticipoUsd: string;
    saldoUsd: string;
    totalUsd: string;
    fechaEntregaEstimada?: string | null;
    descripcionReferencia?: string | null;
    cliente: { nombre: string; telefono?: string | null };
    maquina?: { nombre: string; tipo: string } | null;
  };
}

export interface DashboardResumen {
  total: number;
  porEstado: Record<EstadoMaquina, number>;
}

export interface ReporteResumenDto {
  resumen: {
    totalMaquinas: number;
    totalVentas: number;
    totalClientes: number;
    totalProveedores: number;
    totalVentasUsd: string;
    totalVentasBob: string;
    maquinasCompradas: number;
    maquinasEnProceso: number;
    maquinasDisponibles: number;
    maquinasReservadas: number;
    maquinasVendidas: number;
  };
  porEstado: Record<EstadoMaquina, number>;
  ventas: Array<{
    id: string;
    maquinaId: string;
    maquinaNombre: string;
    maquinaTipo: string;
    proveedor: string;
    clienteNombre: string;
    precioFinalUsd: string;
    precioFinalBob: string;
    tipoCambio: string;
    fechaEntrega: string;
    createdAt: string;
  }>;
  maquinas: Array<{
    id: string;
    nombre: string;
    tipo: string;
    estado: EstadoMaquina;
    proveedor: string;
    registradoPor: string;
    reservadaPor: string | null;
    vendidaA: string | null;
    precioVentaUsd: string | null;
    empleadoDiagnostico: string | null;
    fechaDespacho: string | null;
    fechaLlegadaReal: string | null;
    thumbnailUrl: string | null;
    updatedAt: string;
  }>;
  clientes: Array<{
    id: string;
    nombre: string;
    telefono: string | null;
    totalVentas: number;
    totalPedidos: number;
  }>;
  proveedores: Array<{
    id: string;
    nombre: string;
    totalMaquinas: number;
  }>;
}

export interface ReporteTrabajoDto {
  id: string;
  maquinaId: string;
  maquinaNombre: string;
  maquinaTipo: string;
  maquinaEstado: EstadoMaquina;
  empleado: string;
  especialidad: string | null;
  area: AreaIntervencion;
  tipo: TipoIntervencion;
  descripcion: string;
  detalleTrabajo: string | null;
  observaciones: string | null;
  estadoIntervencion: EstadoIntervencion | null;
  estadoAprobacion: string | null;
  fechaAsignacion: string | null;
  fechaInicio: string | null;
  fechaFinalizacion: string | null;
  fechaAprobacion: string | null;
  registradoPor: string;
  aprobadoPor: string | null;
  createdAt: string;
}

export interface CreateMaquinaRequest {
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number;
  proveedorId: string;
  descripcionLlegada?: string;
  descripcionAcordada?: string;
  fechaCompra?: string;
  fechaLlegadaEstimada?: string;
}

export interface UpdateMaquinaEstadoRequest {
  estado: EstadoMaquina;
  motivo?: string;
}

export interface CreateIntervencionRequest {
  tipo: TipoIntervencion;
  area: AreaIntervencion;
  descripcion: string;
  responsableId: string;
}

export interface CreateEmpleadoRequest {
  nombre: string;
  apellido: string;
  email: string;
  carnet?: string;
  username?: string;
  password: string;
  especialidad: Especialidad;
  telefono?: string;
}

export interface CreateProveedorRequest {
  nombre: string;
}

export interface CreateClienteRequest {
  nombre: string;
  nitCi?: string;
  telefono?: string;
  notas?: string;
}

export interface NuevaMaquinaReservaRequest {
  nombre: string;
  tipo?: string;
  marca: string;
  modelo: string;
  anio: number;
  proveedorId?: string;
}

export interface CreatePedidoRequest {
  clienteId: string;
  maquinaId?: string;
  nuevaMaquina?: NuevaMaquinaReservaRequest;
  descripcionReferencia?: string;
  anticipoUsd: string;
  saldoUsd: string;
  totalUsd: string;
  fechaEntregaEstimada?: string;
}

export interface CreateVentaRequest {
  maquinaId: string;
  clienteId: string;
  precioFinalUsd: string;
  precioFinalBob: string;
  tipoCambio: string;
  fechaEntrega: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
