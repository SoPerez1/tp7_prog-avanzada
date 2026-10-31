import { connectMongo } from '@rutasur/shared';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);

    const { db } = await connectMongo();
    const enviosCol = db.collection('envios');
    const alertasCol = db.collection('alertas');

    // 1. Envíos recientes ordenados por última actualización descendente
    const envios = await enviosCol
      .find({})
      .sort({ actualizadoEn: -1, _id: -1 })
      .limit(limit)
      .toArray();

    // 2. Alertas abiertas activas ordenadas por prioridad
    const alertas = await alertasCol
      .find({ estado: 'ABIERTA' })
      .sort({ creadaEn: -1 })
      .limit(50)
      .toArray();

    // 3. Contadores agregados por estado
    const contadoresAgg = await enviosCol
      .aggregate([
        {
          $group: {
            _id: '$estado',
            total: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const contadores = {
      TOTAL: 0,
      CREADO: 0,
      INGRESADO_HUB: 0,
      CLASIFICADO: 0,
      EN_REPARTO: 0,
      ENTREGADO: 0,
      ENTREGA_FALLIDA: 0,
      ALERTAS_ABIERTAS: alertas.length,
    };

    for (const c of contadoresAgg) {
      if (c._id && contadores[c._id] !== undefined) {
        contadores[c._id] = c.total;
      }
      contadores.TOTAL += c.total;
    }

    return Response.json({
      contadores,
      envios,
      alertas,
      servidorHora: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

