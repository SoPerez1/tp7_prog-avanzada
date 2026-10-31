import {
  createKafka,
  connectMongo,
  logger,
  TOPICS,
  GROUPS,
  SCHEMAS,
} from '@rutasur/shared';

const log = logger('analitica-replay');
const { client, db } = await connectMongo();
const colHubTiempos = db.collection('metricas_hub_tiempos');

// Nuevo grupo de consumidores para demostrar retención y replay sin afectar a los demás servicios
const groupId = process.env.REPLAY_GROUP ?? GROUPS.ANALITICA_REPLAY;
const kafka = createKafka('analitica-replay');
const consumer = kafka.consumer({ groupId });

const enviosHub = new Map(); // shipmentId -> { hubId, ingresadoEn, repartoEn }
const statsPorHub = new Map(); // hubId -> { totalMs, count, minMs, maxMs }

function agregarMuestra(hubId, duracionMs) {
  let h = statsPorHub.get(hubId);
  if (!h) {
    h = { totalMs: 0, count: 0, minMs: Infinity, maxMs: -Infinity };
    statsPorHub.set(hubId, h);
  }
  h.totalMs += duracionMs;
  h.count += 1;
  h.minMs = Math.min(h.minMs, duracionMs);
  h.maxMs = Math.max(h.maxMs, duracionMs);
}

async function guardarEnMongo() {
  const filas = [];
  for (const [hubId, h] of statsPorHub.entries()) {
    const promedioMinutos = Math.round((h.totalMs / h.count / 60000) * 10) / 10;
    const promedioHoras = Math.round((h.totalMs / h.count / 3600000) * 10) / 10;
    const minHoras = Math.round((h.minMs / 3600000) * 10) / 10;
    const maxHoras = Math.round((h.maxMs / 3600000) * 10) / 10;

    await colHubTiempos.updateOne(
      { hubId },
      {
        $set: {
          hubId,
          promedioMinutos,
          promedioHoras,
          totalEnvios: h.count,
          minHoras,
          maxHoras,
          calculadoEn: new Date(),
        },
      },
      { upsert: true },
    );

    filas.push({
      Hub: hubId,
      'Total Envíos': h.count,
      'Tiempo Medio (hs)': promedioHoras,
      'Mínimo (hs)': minHoras,
      'Máximo (hs)': maxHoras,
    });
  }

  if (filas.length > 0) {
    console.log('\n[CU4 - Reprocesamiento] 4º Indicador: Tiempo medio INGRESADO_HUB -> EN_REPARTO');
    console.table(filas);
  }
}

log(`Iniciando consumidor con replay desde el inicio en grupo "${groupId}"...`);
await consumer.connect();
await consumer.subscribe({ topic: TOPICS.ESTADOS, fromBeginning: true });

let cambiosPendientes = false;
const intervaloGuardado = setInterval(async () => {
  if (cambiosPendientes) {
    cambiosPendientes = false;
    await guardarEnMongo();
  }
}, 3000);

await consumer.run({
  autoCommit: true,
  eachMessage: async ({ message }) => {
    let ev;
    try {
      ev = JSON.parse(message.value?.toString() ?? '');
    } catch {
      return;
    }

    const r = SCHEMAS[TOPICS.ESTADOS].safeParse(ev);
    if (!r.success) return;
    const evento = r.data;

    let e = enviosHub.get(evento.shipmentId);
    if (!e) {
      e = { hubId: evento.hubId, ingresadoEn: null, repartoEn: null, procesado: false };
      enviosHub.set(evento.shipmentId, e);
    }
    e.hubId = e.hubId ?? evento.hubId;

    if (evento.tipo === 'INGRESADO_HUB' && !e.ingresadoEn) {
      e.ingresadoEn = Date.parse(evento.ocurridoEn);
    }

    if (evento.tipo === 'EN_REPARTO' && !e.repartoEn) {
      e.repartoEn = Date.parse(evento.ocurridoEn);
    }

    if (e.ingresadoEn && e.repartoEn && !e.procesado) {
      const duracionMs = e.repartoEn - e.ingresadoEn;
      if (duracionMs >= 0) {
        agregarMuestra(e.hubId, duracionMs);
        e.procesado = true;
        cambiosPendientes = true;
      }
    }
  },
});

log('Consumidor de replay en ejecución.');

const shutdown = async () => {
  clearInterval(intervaloGuardado);
  await guardarEnMongo();
  await consumer.disconnect();
  await client.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

