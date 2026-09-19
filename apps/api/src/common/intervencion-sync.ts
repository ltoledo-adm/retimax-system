import { EstadoIntervencion, PrismaClient, TipoIntervencion } from '@prisma/client';

/** Copia el cierre del técnico desde filas viejas de diagnóstico al trabajo de mantenimiento real. */
export async function syncTrabajosDesdeDiagnosticoLegacy(
  prisma: PrismaClient,
  maquinaId: string,
) {
  const diagFinalizados = await prisma.intervencion.findMany({
    where: {
      maquinaId,
      tipo: TipoIntervencion.DIAGNOSTICO_INICIAL,
      estadoIntervencion: EstadoIntervencion.FINALIZADO,
    },
  });
  if (!diagFinalizados.length) return;

  for (const d of diagFinalizados) {
    const trabajo = await prisma.intervencion.findFirst({
      where: {
        maquinaId,
        tipo: TipoIntervencion.TRABAJO_REALIZADO,
        area: d.area,
        responsableId: d.responsableId,
        estadoIntervencion: {
          in: [
            EstadoIntervencion.ASIGNADO,
            EstadoIntervencion.EN_PROCESO,
            EstadoIntervencion.RECHAZADO,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!trabajo) continue;

    await prisma.intervencion.update({
      where: { id: trabajo.id },
      data: {
        estadoIntervencion: EstadoIntervencion.FINALIZADO,
        estadoAprobacion: d.estadoAprobacion,
        fechaInicio: d.fechaInicio ?? trabajo.fechaInicio,
        fechaFinalizacion: d.fechaFinalizacion ?? new Date(),
        detalleTrabajo: d.detalleTrabajo ?? trabajo.detalleTrabajo,
        observaciones: d.observaciones ?? trabajo.observaciones,
        finalizadoPorId: d.finalizadoPorId ?? trabajo.finalizadoPorId,
      },
    });
  }
}
