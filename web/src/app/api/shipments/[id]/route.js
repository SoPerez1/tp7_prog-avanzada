import { connectMongo } from '@rutasur/shared';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const shipmentId = params.id;
    const { searchParams } = new URL(request.url);
    const esPublico = searchParams.get('public') === 'true';

    const { db } = await connectMongo();
    const envio = await db.collection('envios').findOne({ _id: shipmentId });

    if (!envio) {
      return Response.json({ error: 'Envío no encontrado' }, { status: 404 });
    }

    // Si es vista pública para el destinatario (Tracking Público):
    // Se excluyen repartidorId, alertas internas de SLA, hubs internos y detalles técnicos
    if (esPublico) {
      const mapeoEstadoPublico = {
        CREADO: 'En preparación',
        INGRESADO_HUB: 'En centro de distribución',
        CLASIFICADO: 'Listo para despacho',
        EN_REPARTO: 'En camino a tu domicilio',
        ENTREGADO: 'Entregado',
        ENTREGA_FALLIDA: envio.reprogramacion?.accion === 'REPROGRAMADO'
          ? 'Visita realizada - Entrega reprogramada'
          : envio.reprogramacion?.accion === 'RETENIDO'
          ? 'Visita realizada - Requiere verificación de datos'
          : envio.reprogramacion?.accion === 'DEVOLUCION'
          ? 'En proceso de devolución al remitente'
          : 'Entrega no completada',
      };

      return Response.json({
        shipmentId: envio.shipmentId,
        estadoPublico: mapeoEstadoPublico[envio.estado] ?? envio.estado,
        estado: envio.estado,
        fechaEstimada: envio.reprogramacion?.proximoIntento ?? envio.promesa?.venceEn ?? null,
        franjaEstimada: envio.reprogramacion?.franja ?? null,
        actualizadoEn: envio.actualizadoEn,
        historialPublico: (envio.historial ?? []).map((h) => ({
          tipo: mapeoEstadoPublico[h.tipo] ?? h.tipo,
          ocurridoEn: h.ocurridoEn,
        })),
      });
    }

    // Vista interna completa para el Supervisor (Detalle del envío)
    const alertas = await db
      .collection('alertas')
      .find({ shipmentId })
      .sort({ creadaEn: -1 })
      .toArray();

    const notificaciones = await db
      .collection('notificaciones')
      .find({ shipmentId })
      .sort({ ocurridoEn: -1 })
      .toArray();

    return Response.json({
      ...envio,
      alertas,
      notificaciones,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

