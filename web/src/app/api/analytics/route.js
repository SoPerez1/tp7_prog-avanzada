import { connectMongo } from '@rutasur/shared';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const zonaId = searchParams.get('zonaId');
    const hubId = searchParams.get('hubId');
    const fecha = searchParams.get('fecha');

    const { db } = await connectMongo();

    const filtro = {};
    if (zonaId) filtro.zonaId = zonaId;
    if (hubId) filtro.hubId = hubId;
    if (fecha) filtro.fecha = fecha;

    const metricas = await db
      .collection('metricas_diarias')
      .find(filtro)
      .sort({ fecha: -1 })
      .toArray();

    const hubTiempos = await db
      .collection('metricas_hub_tiempos')
      .find({})
      .toArray();

    // 1. Tasa de entrega en primer intento global y por zona
    let totalEntregas1er = 0;
    let totalFallos1er = 0;
    const porZona = {};
    const motivosGlobal = {
      AUSENTE: 0,
      DIRECCION_INCORRECTA: 0,
      RECHAZADO: 0,
      ZONA_INACCESIBLE: 0,
    };
    let slaCumplidos = 0;
    let slaIncumplidos = 0;

    for (const m of metricas) {
      totalEntregas1er += m.entregasPrimerIntento ?? 0;
      totalFallos1er += m.fallosPrimerIntento ?? 0;
      slaCumplidos += m.slaCumplidos ?? 0;
      slaIncumplidos += m.slaIncumplidos ?? 0;

      if (!porZona[m.zonaId]) {
        porZona[m.zonaId] = {
          zonaId: m.zonaId,
          hubId: m.hubId,
          entregados1er: 0,
          fallos1er: 0,
          totalFallos: 0,
          motivos: {},
        };
      }
      porZona[m.zonaId].entregados1er += m.entregasPrimerIntento ?? 0;
      porZona[m.zonaId].fallos1er += m.fallosPrimerIntento ?? 0;
      porZona[m.zonaId].totalFallos += m.fallos ?? 0;

      if (m.motivos) {
        for (const [motivo, cant] of Object.entries(m.motivos)) {
          motivosGlobal[motivo] = (motivosGlobal[motivo] ?? 0) + cant;
          porZona[m.zonaId].motivos[motivo] = (porZona[m.zonaId].motivos[motivo] ?? 0) + cant;
        }
      }
    }

    const totalIntentos1er = totalEntregas1er + totalFallos1er;
    const tasaPrimerIntento = totalIntentos1er > 0
      ? Math.round((totalEntregas1er / totalIntentos1er) * 1000) / 10
      : 100;

    const totalEvaluadosSLA = slaCumplidos + slaIncumplidos;
    const tasaCumplimientoSLA = totalEvaluadosSLA > 0
      ? Math.round((slaCumplidos / totalEvaluadosSLA) * 1000) / 10
      : 100;

    return Response.json({
      resumen: {
        tasaPrimerIntento,
        totalEntregas1er,
        totalFallos1er,
        tasaCumplimientoSLA,
        slaCumplidos,
        slaIncumplidos,
        totalEvaluadosSLA,
        motivosGlobal,
      },
      porZona: Object.values(porZona),
      hubTiempos,
      metricasRaw: metricas,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

