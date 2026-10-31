import {
  createKafka,
  connectMongo,
  runConsumer,
  logger,
  TOPICS,
  GROUPS,
  SCHEMAS,
  eventIdNotificacion,
} from '@rutasur/shared';

const log = logger('notificaciones');
const { client, db } = await connectMongo();
const kafka = createKafka('notificaciones');
const producer = kafka.producer();
await producer.connect();

async function handleEstado(ev) {
  if (ev.tipo !== 'ENTREGA_FALLIDA') return 'ignorado';

  // Determinismo: eventId derivado del evento original para garantizar exactamente-una
  // notificación ante reintentos del consumidor 'al menos una vez'
  const id = eventIdNotificacion(ev.eventId);
  const notif = {
    eventId: id,
    shipmentId: ev.shipmentId,
    tipo: 'NOTIFICACION',
    canal: 'EMAIL',
    destinatario: `destinatario_${ev.shipmentId}@ejemplo.com`,
    mensaje: `No pudimos entregar tu paquete (intento ${ev.intento}/3). Motivo: ${ev.motivo}. Podés seleccionar una nueva fecha de entrega o coordinar retiro en hub.`,
    opciones: ['REPROGRAMAR_FECHA', 'CAMBIAR_DIRECCION', 'RETIRAR_EN_HUB'],
    ocurridoEn: ev.ocurridoEn,
    hubId: ev.hubId,
    zonaId: ev.zonaId,
    version: 1,
  };

  await producer.send({
    topic: TOPICS.NOTIFICACIONES,
    messages: [
      {
        key: ev.shipmentId,
        value: JSON.stringify(notif),
      },
    ],
  });

  return 'notificacion_publicada';
}

async function handleAlerta(ev) {
  if (ev.estado !== 'ABIERTA') return 'ignorado';

  const id = eventIdNotificacion(ev.eventId);
  const notif = {
    eventId: id,
    shipmentId: ev.shipmentId,
    tipo: 'ALERTA_SLA',
    canal: 'SMS',
    destinatario: `destinatario_${ev.shipmentId}@ejemplo.com`,
    mensaje: `Aviso: tu paquete presenta una demora operativa (${ev.causa}). Estamos trabajando para entregarlo a la brevedad.`,
    opciones: ['CONSULTAR_ESTADO'],
    ocurridoEn: ev.ocurridoEn,
    hubId: ev.hubId,
    zonaId: ev.zonaId,
    version: 1,
  };

  await producer.send({
    topic: TOPICS.NOTIFICACIONES,
    messages: [
      {
        key: ev.shipmentId,
        value: JSON.stringify(notif),
      },
    ],
  });

  return 'alerta_notificada';
}

const consumer = await runConsumer({
  kafka,
  groupId: GROUPS.NOTIFICACIONES,
  topics: [TOPICS.ESTADOS, TOPICS.ALERTAS],
  schemas: SCHEMAS,
  db,
  fromBeginning: true,
  handler: ({ topic, evento }) =>
    topic === TOPICS.ESTADOS ? handleEstado(evento) : handleAlerta(evento),
});

log('servicio de notificaciones listo');

const shutdown = async () => {
  await consumer.stop();
  await producer.disconnect();
  await client.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

