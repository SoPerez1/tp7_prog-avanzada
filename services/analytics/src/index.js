import {
  createKafka,
  connectMongo,
  runConsumer,
  logger,
  TOPICS,
  GROUPS,
  SCHEMAS,
} from '@rutasur/shared';

const log = logger('analitica');
const { client, db } = await connectMongo();
const metricas = db.collection('metricas_diarias');
const colPromesas = db.collection('analitica_promesas');
const colEnvios = db.collection('envios');
const kafka = createKafka('analitica');

// Manejo de promesas de entrega para cálculo del Indicador 3 (Cumplimiento de SLA)
async function handlePromesa(ev) {
  await colPromesas.updateOne(
    { shipmentId: ev.shipmentId },
    {
      $set: {
        shipmentId: ev.shipmentId,
        venceEn: new Date(ev.venceEn),
        hubId: ev.hubId,
        zonaId: ev.zonaId,
      },
    },
    { upsert: true },
  );
  return 'promesa_almacenada';
}

async function handleEstado(ev) {
  const fecha = ev.ocurridoEn.slice(0, 10);
  const hora = new Date(ev.ocurridoEn).getUTCHours();
  const franja = hora < 13 ? 'MANANA' : 'TARDE';

  // 1. Indicador 2: Distribución de motivos de fallo y fallos de primer intento
  if (ev.tipo === 'ENTREGA_FALLIDA') {
    const inc = {
      fallos: 1,
      [`motivos.${ev.motivo}`]: 1,
    };
    if (ev.intento === 1) inc.fallosPrimerIntento = 1;
    else if (ev.intento === 2) inc.fallosSegundoIntento = 1;
    else if (ev.intento >= 3) inc.fallosTercerIntento = 1;

    await metricas.updateOne(
      { fecha, zonaId: ev.zonaId, franja },
      {
        $setOnInsert: { hubId: ev.hubId },
        $set: { actualizadoEn: new Date() },
        $inc: inc,
      },
      { upsert: true },
    );
    return 'metrica_fallo_incrementada';
  }

  // 2. Indicadores 1 y 3: Tasa de entrega en primer intento y Cumplimiento de SLA
  if (ev.tipo === 'ENTREGADO') {
    // Obtención de la fecha límite para evaluar SLA:
    // Primero busca en el stream propio (analitica_promesas); si no estuviera, fallback a `envios` en MongoDB
    let venceEn = null;
    const p = await colPromesas.findOne({ shipmentId: ev.shipmentId });
    if (p?.venceEn) {
      venceEn = new Date(p.venceEn);
    } else {
      const envioDoc = await colEnvios.findOne(
        { _id: ev.shipmentId },
        { projection: { promesa: 1 } },
      );
      if (envioDoc?.promesa?.venceEn) {
        venceEn = new Date(envioDoc.promesa.venceEn);
      }
    }

    const cumplioSla = venceEn ? new Date(ev.ocurridoEn) <= venceEn : true;

    const inc = {
      entregados: 1,
      ...(ev.intento === 1 ? { entregasPrimerIntento: 1 } : {}),
      ...(cumplioSla ? { slaCumplidos: 1 } : { slaIncumplidos: 1 }),
    };

    await metricas.updateOne(
      { fecha, zonaId: ev.zonaId, franja },
      {
        $setOnInsert: { hubId: ev.hubId },
        $set: { actualizadoEn: new Date() },
        $inc: inc,
      },
      { upsert: true },
    );
    return 'metrica_entregado_incrementada';
  }

  if (ev.tipo === 'CREADO') {
    await metricas.updateOne(
      { fecha, zonaId: ev.zonaId, franja },
      {
        $setOnInsert: { hubId: ev.hubId },
        $set: { actualizadoEn: new Date() },
        $inc: { creados: 1 },
      },
      { upsert: true },
    );
    return 'metrica_creado_incrementada';
  }

  return 'ignorado';
}

const consumer = await runConsumer({
  kafka,
  groupId: GROUPS.ANALITICA,
  topics: [TOPICS.ESTADOS, TOPICS.PROMESAS],
  schemas: SCHEMAS,
  db,
  fromBeginning: true,
  handler: ({ topic, evento }) =>
    topic === TOPICS.PROMESAS ? handlePromesa(evento) : handleEstado(evento),
});

log('servicio de analítica listo');

const shutdown = async () => {
  await consumer.stop();
  await client.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
