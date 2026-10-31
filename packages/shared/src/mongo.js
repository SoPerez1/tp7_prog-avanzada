import { MongoClient } from 'mongodb';

export async function connectMongo() {
  const client = new MongoClient(
    process.env.MONGO_URI ?? 'mongodb://localhost:27017/?directConnection=true',
  );
  await client.connect();
  const db = client.db(process.env.MONGO_DB ?? 'rutasur');
  await ensureIndexes(db);
  return { client, db };
}

// Índices del modelo de datos (idempotente: se puede llamar en cada arranque)
export async function ensureIndexes(db) {
  await db.collection('envios').createIndexes([
    { key: { shipmentId: 1 }, unique: true },
    { key: { estado: 1, zonaId: 1 } },
    { key: { 'promesa.venceEn': 1 } },
  ]);
  await db.collection('alertas').createIndexes([
    { key: { estado: 1, prioridad: 1 } },
    { key: { shipmentId: 1 } },
  ]);
  await db.collection('notificaciones').createIndex({ shipmentId: 1 });
  await db.collection('metricas_diarias').createIndex(
    { fecha: 1, zonaId: 1, franja: 1 },
    { unique: true },
  );
  await db.collection('eventos_procesados').createIndexes([
    { key: { consumidor: 1, eventId: 1 }, unique: true },
    { key: { procesadoEn: 1 }, expireAfterSeconds: 7 * 24 * 3600 },
  ]);
  await db.collection('sla_seguimiento').createIndexes([
    { key: { shipmentId: 1 }, unique: true },
    { key: { cerrado: 1 } },
  ]);
  await db.collection('metricas_hub_tiempos').createIndex({ hubId: 1 }, { unique: true });
}
