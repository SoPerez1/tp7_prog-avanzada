import { createKafka, connectMongo, runConsumer, logger, TOPICS, GROUPS, SCHEMAS } from '@rutasur/shared';

const log = logger('proyector');
const { client, db } = await connectMongo();
const envios = db.collection('envios');
const alertas = db.collection('alertas');
const notificaciones = db.collection('notificaciones');

// Estado: un único updateOne atómico que implementa la regla de orden.
// Solo aplica si ultimaSecuencia < secuencia. Si el documento ya existe con una secuencia
// mayor o igual, el filtro no matchea, el upsert intenta insertar el mismo _id y Mongo lanza
// E11000: eso significa "evento viejo", se descarta sin tocar nada.
async function aplicarEstado(ev) {
  try {
    await envios.updateOne(
      { _id: ev.shipmentId, ultimaSecuencia: { $lt: ev.secuencia } },
      {
        $set: {
          shipmentId: ev.shipmentId,
          estado: ev.tipo,
          motivo: ev.motivo ?? null,
          hubId: ev.hubId,
          zonaId: ev.zonaId,
          repartidorId: ev.repartidorId,
          ultimaSecuencia: ev.secuencia,
          actualizadoEn: new Date(ev.ocurridoEn),
        },
        $max: { intentos: ev.intento },
        ...(ev.tipo === 'ENTREGA_FALLIDA' ? { $inc: { fallos: 1 } } : {}),
        $push: {
          historial: {
            eventId: ev.eventId,
            tipo: ev.tipo,
            ocurridoEn: new Date(ev.ocurridoEn),
            secuencia: ev.secuencia,
            intento: ev.intento,
            ...(ev.motivo ? { motivo: ev.motivo } : {}),
          },
        },
      },
      { upsert: true },
    );
    return 'aplicado';
  } catch (e) {
    if (e.code === 11000) return 'descartado:secuencia_vieja';
    throw e;
  }
}

// La promesa puede llegar antes o después del primer estado: upsert sin tocar la secuencia
async function aplicarPromesa(ev) {
  await envios.updateOne(
    { _id: ev.shipmentId },
    {
      $set: {
        shipmentId: ev.shipmentId,
        hubId: ev.hubId,
        zonaId: ev.zonaId,
        promesa: { venceEn: new Date(ev.venceEn) },
      },
      $setOnInsert: { estado: null, ultimaSecuencia: 0, intentos: 0, fallos: 0, historial: [] },
    },
    { upsert: true },
  );
  return 'aplicado';
}

// Reprogramación: refleja la decisión del servicio de reprogramación en el envío e historial
async function aplicarReprogramacion(ev) {
  const res = await envios.updateOne(
    { _id: ev.shipmentId, 'reprogramaciones.eventId': { $ne: ev.eventId } },
    {
      $set: {
        reprogramacion: {
          eventId: ev.eventId,
          accion: ev.accion,
          motivo: ev.motivo ?? null,
          intento: ev.intento,
          proximoIntento: ev.proximoIntento ? new Date(ev.proximoIntento) : null,
          franja: ev.franja ?? null,
          ocurridoEn: new Date(ev.ocurridoEn),
        },
      },
      $push: {
        historial: {
          eventId: ev.eventId,
          tipo: `REPROGRAMACION_${ev.accion}`,
          accion: ev.accion,
          motivo: ev.motivo ?? null,
          intento: ev.intento,
          proximoIntento: ev.proximoIntento ? new Date(ev.proximoIntento) : null,
          franja: ev.franja ?? null,
          ocurridoEn: new Date(ev.ocurridoEn),
        },
        reprogramaciones: {
          eventId: ev.eventId,
          accion: ev.accion,
          motivo: ev.motivo ?? null,
          intento: ev.intento,
          proximoIntento: ev.proximoIntento ? new Date(ev.proximoIntento) : null,
          franja: ev.franja ?? null,
          ocurridoEn: new Date(ev.ocurridoEn),
        },
      },
    },
  );
  return res.modifiedCount > 0 ? 'aplicado' : 'duplicado_ignorado';
}

// Notificación: registra la notificación simulada en la colección `notificaciones` y en el envío
async function aplicarNotificacion(ev) {
  await notificaciones.updateOne(
    { _id: ev.eventId },
    {
      $set: {
        eventId: ev.eventId,
        shipmentId: ev.shipmentId,
        tipo: ev.tipo,
        canal: ev.canal,
        destinatario: ev.destinatario,
        mensaje: ev.mensaje,
        opciones: ev.opciones ?? [],
        hubId: ev.hubId,
        zonaId: ev.zonaId,
        ocurridoEn: new Date(ev.ocurridoEn),
        registradoEn: new Date(),
      },
    },
    { upsert: true },
  );

  await envios.updateOne(
    { _id: ev.shipmentId, 'notificaciones.eventId': { $ne: ev.eventId } },
    {
      $push: {
        notificaciones: {
          eventId: ev.eventId,
          canal: ev.canal,
          mensaje: ev.mensaje,
          tipo: ev.tipo,
          ocurridoEn: new Date(ev.ocurridoEn),
        },
      },
    },
  );
  return 'aplicado';
}

// Alerta: registra o cierra la alerta de SLA en la colección `alertas` y en el envío
async function aplicarAlerta(ev) {
  if (ev.estado === 'CERRADA' || ev.tipo === 'CIERRE_ALERTA') {
    await alertas.updateMany(
      { shipmentId: ev.shipmentId, estado: 'ABIERTA' },
      { $set: { estado: 'CERRADA', cerradaEn: new Date(ev.ocurridoEn) } },
    );
    await envios.updateOne(
      { _id: ev.shipmentId },
      { $set: { tieneAlerta: false } },
    );
  } else {
    const alertaId = `alerta_${ev.shipmentId}_${ev.regla}`;
    await alertas.updateOne(
      { _id: alertaId },
      {
        $set: {
          alertaId,
          eventId: ev.eventId,
          shipmentId: ev.shipmentId,
          regla: ev.regla,
          prioridad: ev.prioridad,
          causa: ev.causa,
          estado: 'ABIERTA',
          hubId: ev.hubId,
          zonaId: ev.zonaId,
          creadaEn: new Date(ev.ocurridoEn),
        },
      },
      { upsert: true },
    );
    await envios.updateOne(
      { _id: ev.shipmentId },
      {
        $set: { tieneAlerta: true },
        $push: {
          alertas: {
            eventId: ev.eventId,
            regla: ev.regla,
            prioridad: ev.prioridad,
            estado: ev.estado,
            causa: ev.causa,
            ocurridoEn: new Date(ev.ocurridoEn),
          },
        },
      },
    );
  }
  return 'aplicado';
}

const consumer = await runConsumer({
  kafka: createKafka('proyector'),
  groupId: GROUPS.PROYECTOR,
  topics: [
    TOPICS.ESTADOS,
    TOPICS.PROMESAS,
    TOPICS.REPROGRAMACIONES,
    TOPICS.ALERTAS,
    TOPICS.NOTIFICACIONES,
  ],
  schemas: SCHEMAS,
  db,
  fromBeginning: true,
  handler: ({ topic, evento }) => {
    switch (topic) {
      case TOPICS.ESTADOS: return aplicarEstado(evento);
      case TOPICS.PROMESAS: return aplicarPromesa(evento);
      case TOPICS.REPROGRAMACIONES: return aplicarReprogramacion(evento);
      case TOPICS.ALERTAS: return aplicarAlerta(evento);
      case TOPICS.NOTIFICACIONES: return aplicarNotificacion(evento);
      default: return 'descartado:topic_desconocido';
    }
  },
});
log('proyector listo');

const shutdown = async () => { await consumer.stop(); await client.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
