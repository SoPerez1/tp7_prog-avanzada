import {
  createKafka,
  connectMongo,
  runConsumer,
  logger,
  TOPICS,
  GROUPS,
  SCHEMAS,
  proximoIntentoLaboral,
  eventIdReprogramacion,
} from '@rutasur/shared';

const log = logger('reprogramacion');
const { client, db } = await connectMongo();
const kafka = createKafka('reprogramacion');
const producer = kafka.producer();
await producer.connect();

async function handleEstado(ev) {
  if (ev.tipo !== 'ENTREGA_FALLIDA') return 'ignorado';

  let accion;
  let proximoIntento = null;
  let franja = null;

  // Reglas de negocio de CU2:
  // 1. Tercer fallo (cualquiera sea el motivo) -> Devolución al comercio
  // 2. AUSENTE (o ZONA_INACCESIBLE) -> Nuevo intento al día hábil siguiente, franja opuesta
  // 3. DIRECCION_INCORRECTA -> Retenido hasta corrección manual
  // 4. RECHAZADO -> Devolución inmediata al comercio
  if (ev.intento >= 3) {
    accion = 'DEVOLUCION';
  } else if (ev.motivo === 'AUSENTE' || ev.motivo === 'ZONA_INACCESIBLE') {
    accion = 'REPROGRAMADO';
    const sig = proximoIntentoLaboral(ev.ocurridoEn);
    proximoIntento = sig.fecha;
    franja = sig.franja;
  } else if (ev.motivo === 'DIRECCION_INCORRECTA') {
    accion = 'RETENIDO';
  } else if (ev.motivo === 'RECHAZADO') {
    accion = 'DEVOLUCION';
  } else {
    accion = 'RETENIDO';
  }

  // Idempotencia determinista: eventId generado a partir del evento disparador
  const id = eventIdReprogramacion(ev.eventId);
  const reprog = {
    eventId: id,
    shipmentId: ev.shipmentId,
    tipo: 'REPROGRAMACION',
    accion,
    motivo: ev.motivo ?? null,
    intento: ev.intento,
    proximoIntento,
    franja,
    ocurridoEn: ev.ocurridoEn,
    hubId: ev.hubId,
    zonaId: ev.zonaId,
    version: 1,
  };

  await producer.send({
    topic: TOPICS.REPROGRAMACIONES,
    messages: [
      {
        key: ev.shipmentId,
        value: JSON.stringify(reprog),
      },
    ],
  });

  return `reprogramacion_${accion.toLowerCase()}`;
}

const consumer = await runConsumer({
  kafka,
  groupId: GROUPS.REPROGRAMACION,
  topics: [TOPICS.ESTADOS],
  schemas: SCHEMAS,
  db,
  fromBeginning: true,
  handler: ({ evento }) => handleEstado(evento),
});

log('servicio de reprogramación listo');

const shutdown = async () => {
  await consumer.stop();
  await producer.disconnect();
  await client.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

