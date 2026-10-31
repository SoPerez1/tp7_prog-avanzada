import {
  createKafka,
  connectMongo,
  runConsumer,
  logger,
  TOPICS,
  GROUPS,
  SCHEMAS,
} from '@rutasur/shared';

const log = logger('monitor-sla');
const { client, db } = await connectMongo();
const colSeguimiento = db.collection('sla_seguimiento');

const kafka = createKafka('monitor-sla');
const producer = kafka.producer();
await producer.connect();

// 1. Estado en memoria de envíos activos
const seguimiento = new Map();

// Carga inicial desde MongoDB para sobrevivir a reinicios
const guardados = await colSeguimiento.find({ cerrado: false }).toArray();
for (const doc of guardados) {
  seguimiento.set(doc.shipmentId, {
    ...doc,
    alertasEmitidas: new Set(doc.alertasEmitidas ?? []),
  });
}
log(`Estado restaurado desde MongoDB: ${seguimiento.size} envíos activos en seguimiento`);

// 2. Reloj simulado con extrapolación por factor de aceleración
let lastSimTime = 0;
let lastRealTime = Date.now();
const ACELERACION = Number(process.env.ACELERACION ?? 120); // 1h simulada = 30s reales -> 120x

function syncReloj(isoString) {
  const t = Date.parse(isoString);
  if (!isNaN(t) && t > lastSimTime) {
    lastSimTime = t;
    lastRealTime = Date.now();
  }
}

function getSimNow() {
  if (!lastSimTime) return Date.now();
  const transcurridoRealMs = Date.now() - lastRealTime;
  return lastSimTime + transcurridoRealMs * ACELERACION;
}

// 3. Respaldo atómico en MongoDB
async function persistir(s) {
  await colSeguimiento.updateOne(
    { shipmentId: s.shipmentId },
    {
      $set: {
        shipmentId: s.shipmentId,
        estado: s.estado,
        venceEn: s.venceEn,
        hubId: s.hubId,
        zonaId: s.zonaId,
        ingresadoHub: s.ingresadoHub,
        enReparto: s.enReparto,
        entregado: s.entregado,
        cerrado: s.cerrado,
        ultimoFallo: s.ultimoFallo,
        alertasEmitidas: Array.from(s.alertasEmitidas),
        actualizadoEn: new Date(),
      },
    },
    { upsert: true },
  );
}

// 4. Emisión de alertas (con no repetición de la misma regla)
async function emitirAlerta(s, regla, prioridad, causa, simNow) {
  if (s.alertasEmitidas.has(regla)) return;

  s.alertasEmitidas.add(regla);
  await persistir(s);

  const evAlerta = {
    eventId: `alerta_${regla}_${s.shipmentId}`,
    shipmentId: s.shipmentId,
    tipo: 'ALERTA_SLA',
    estado: 'ABIERTA',
    regla,
    prioridad,
    causa,
    ocurridoEn: new Date(simNow).toISOString(),
    hubId: s.hubId,
    zonaId: s.zonaId,
    version: 1,
  };

  await producer.send({
    topic: TOPICS.ALERTAS,
    messages: [
      {
        key: s.shipmentId,
        value: JSON.stringify(evAlerta),
      },
    ],
  });

  log(`Alerta emitida [${prioridad}] regla=${regla} envío=${s.shipmentId}`);
}

// 5. Cierre de alerta al entregar el paquete
async function cerrarAlertas(s, simNow) {
  if (s.alertasEmitidas.size === 0) return;

  const evCierre = {
    eventId: `cierre_alerta_${s.shipmentId}`,
    shipmentId: s.shipmentId,
    tipo: 'CIERRE_ALERTA',
    estado: 'CERRADA',
    regla: 'VENCIDO',
    prioridad: 'MEDIA',
    causa: 'Envío entregado, se cierran las alertas activas',
    ocurridoEn: new Date(simNow).toISOString(),
    hubId: s.hubId,
    zonaId: s.zonaId,
    version: 1,
  };

  await producer.send({
    topic: TOPICS.ALERTAS,
    messages: [
      {
        key: s.shipmentId,
        value: JSON.stringify(evCierre),
      },
    ],
  });

  log(`Cierre de alertas emitido para envío=${s.shipmentId}`);
}

// 6. Evaluación de las 4 reglas del caso de uso CU3
async function evaluarEnvio(s, simNow) {
  if (s.entregado || s.cerrado || !s.venceEn) return;

  const msParaVencer = s.venceEn - simNow;
  const horasParaVencer = msParaVencer / (3600 * 1000);

  // Regla 4: Vencido (Prioridad: Crítica)
  // Pasó el vencimiento sin ENTREGADO
  if (simNow > s.venceEn) {
    await emitirAlerta(
      s,
      'VENCIDO',
      'CRITICA',
      'Pasó la fecha/hora de vencimiento de la promesa sin entrega',
      simNow,
    );
  }

  // Regla 3: Fallo en el día límite (Prioridad: Alta)
  // ENTREGA_FALLIDA y la promesa vence hoy
  if (s.estado === 'ENTREGA_FALLIDA' && s.ultimoFallo) {
    const diaFallo = new Date(s.ultimoFallo).toISOString().slice(0, 10);
    const diaVence = new Date(s.venceEn).toISOString().slice(0, 10);
    if (diaFallo === diaVence) {
      await emitirAlerta(
        s,
        'FALLO_DIA_LIMITE',
        'ALTA',
        'Entrega fallida registrada en el día límite del vencimiento',
        simNow,
      );
    }
  }

  // Regla 2: Sin salida (Prioridad: Alta)
  // Faltan menos de 4 h y no está en reparto
  if (!s.enReparto && horasParaVencer < 4 && horasParaVencer > 0) {
    await emitirAlerta(
      s,
      'SIN_SALIDA',
      'ALTA',
      `Faltan menos de 4 horas (${horasParaVencer.toFixed(1)} h) y el envío aún no salió a reparto`,
      simNow,
    );
  }

  // Regla 1: Sin ingreso (Prioridad: Media)
  // Faltan menos de 10 h para el vencimiento y no ingresó al hub
  if (!s.ingresadoHub && horasParaVencer < 10 && horasParaVencer > 0) {
    await emitirAlerta(
      s,
      'SIN_INGRESO',
      'MEDIA',
      `Faltan menos de 10 horas (${horasParaVencer.toFixed(1)} h) y el paquete aún no ingresó al hub`,
      simNow,
    );
  }
}

// 7. Intervalo de evaluación periódica (cada 1 minuto simulado)
// A 120x, 1 min simulado = 500 ms reales
const EVAL_INTERVAL_MS = Math.max(250, Math.round(60000 / ACELERACION));
const timer = setInterval(async () => {
  const simNow = getSimNow();
  for (const s of seguimiento.values()) {
    if (!s.entregado && !s.cerrado) {
      await evaluarEnvio(s, simNow);
    }
  }
}, EVAL_INTERVAL_MS);

// 8. Procesamiento de eventos desde Kafka
function obtenerEnvio(shipmentId) {
  let s = seguimiento.get(shipmentId);
  if (!s) {
    s = {
      shipmentId,
      estado: null,
      venceEn: null,
      hubId: null,
      zonaId: null,
      ingresadoHub: false,
      enReparto: false,
      entregado: false,
      cerrado: false,
      ultimoFallo: null,
      alertasEmitidas: new Set(),
    };
    seguimiento.set(shipmentId, s);
  }
  return s;
}

async function handlePromesa(ev) {
  syncReloj(ev.ocurridoEn);
  const s = obtenerEnvio(ev.shipmentId);
  s.venceEn = Date.parse(ev.venceEn);
  s.hubId = s.hubId ?? ev.hubId;
  s.zonaId = s.zonaId ?? ev.zonaId;

  await persistir(s);
  await evaluarEnvio(s, getSimNow());
  return 'promesa_procesada';
}

async function handleEstado(ev) {
  syncReloj(ev.ocurridoEn);
  const s = obtenerEnvio(ev.shipmentId);

  s.estado = ev.tipo;
  s.hubId = ev.hubId;
  s.zonaId = ev.zonaId;

  if (
    ev.tipo === 'INGRESADO_HUB' ||
    ev.tipo === 'CLASIFICADO' ||
    ev.tipo === 'EN_REPARTO' ||
    ev.tipo === 'ENTREGADO'
  ) {
    s.ingresadoHub = true;
  }

  if (ev.tipo === 'EN_REPARTO' || ev.tipo === 'ENTREGADO') {
    s.enReparto = true;
  }

  if (ev.tipo === 'ENTREGA_FALLIDA') {
    s.ultimoFallo = Date.parse(ev.ocurridoEn);
  }

  if (ev.tipo === 'ENTREGADO') {
    s.entregado = true;
    s.cerrado = true;
    await cerrarAlertas(s, Date.parse(ev.ocurridoEn));
    await persistir(s);
    seguimiento.delete(s.shipmentId);
    return 'entrega_completada_alertas_cerradas';
  }

  await persistir(s);
  await evaluarEnvio(s, getSimNow());
  return 'estado_evaluado';
}

const consumer = await runConsumer({
  kafka,
  groupId: GROUPS.MONITOR_SLA,
  topics: [TOPICS.ESTADOS, TOPICS.PROMESAS],
  schemas: SCHEMAS,
  db,
  fromBeginning: true,
  handler: ({ topic, evento }) =>
    topic === TOPICS.PROMESAS ? handlePromesa(evento) : handleEstado(evento),
});

log('monitor de SLA listo');

const shutdown = async () => {
  clearInterval(timer);
  await consumer.stop();
  await producer.disconnect();
  await client.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

