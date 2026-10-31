import { TOPICS } from './topics.js';
import { logger } from './logger.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Consumidor con las garantías que pide el enunciado:
 *  - al menos una vez: el offset se confirma a mano, DESPUÉS de procesar
 *  - idempotente: descarta eventId ya registrado en eventos_procesados
 *  - validación de esquema: lo inválido va a la DLQ y el consumo continúa
 *  - observabilidad: cada mensaje se loguea con eventId, partición y offset
 *
 * handler({ topic, evento, ctx }) puede devolver un string con el resultado (p. ej. "descartado:secuencia").
 * El handler debe ser idempotente por sí mismo: si el proceso muere entre el handler y el registro
 * en eventos_procesados, el evento se reintenta.
 */
export async function runConsumer({ kafka, groupId, topics, schemas, handler, db, fromBeginning = false }) {
  const log = logger(groupId);
  const consumer = kafka.consumer({ groupId });
  const dlq = kafka.producer();
  const procesados = db.collection('eventos_procesados');

  await Promise.all([consumer.connect(), dlq.connect()]);
  for (const topic of topics) await consumer.subscribe({ topic, fromBeginning });

  const aDlq = (message, topic, partition, motivo, detalle) =>
    dlq.send({
      topic: TOPICS.DLQ,
      messages: [{
        key: message.key,
        value: JSON.stringify({
          motivo,
          detalle,
          grupo: groupId,
          origen: { topic, partition, offset: message.offset },
          enviadoEn: new Date().toISOString(),
          payload: message.value?.toString() ?? null,
        }),
      }],
    });

  await consumer.run({
    autoCommit: false,
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const ctx = { topic, partition, offset: message.offset };
      const commit = () =>
        consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);

      let json;
      try {
        json = JSON.parse(message.value?.toString() ?? '');
      } catch {
        await aDlq(message, topic, partition, 'json_invalido', 'no se pudo parsear el JSON');
        log('enviado a DLQ', { ...ctx, motivo: 'json_invalido' });
        return commit();
      }

      const r = schemas[topic].safeParse(json);
      if (!r.success) {
        const detalle = r.error.issues
          .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
          .join('; ');
        await aDlq(message, topic, partition, 'esquema_invalido', detalle);
        log('enviado a DLQ', { ...ctx, motivo: 'esquema_invalido', detalle });
        return commit();
      }
      const evento = r.data;

      const ya = await procesados.findOne(
        { consumidor: groupId, eventId: evento.eventId },
        { projection: { _id: 1 } },
      );
      if (ya) {
        log('duplicado descartado', { ...ctx, eventId: evento.eventId });
        return commit();
      }

      // Un fallo transitorio (p. ej. Mongo caído) NO se commitea ni va a la DLQ:
      // se reintenta con backoff hasta que se recupere.
      let resultado;
      for (let n = 1; ; n++) {
        try {
          resultado = await handler({ topic, evento, ctx });
          break;
        } catch (err) {
          log('error en handler, reintentando', { ...ctx, eventId: evento.eventId, n, error: err.message });
          await heartbeat();
          await sleep(Math.min(5000, 250 * n));
        }
      }

      await procesados.updateOne(
        { consumidor: groupId, eventId: evento.eventId },
        { $setOnInsert: { procesadoEn: new Date() } },
        { upsert: true },
      );
      log(resultado ?? 'aplicado', { ...ctx, eventId: evento.eventId });
      return commit();
    },
  });

  return {
    stop: async () => {
      await consumer.disconnect();
      await dlq.disconnect();
    },
  };
}
