// Reconstruye la proyección: borra `envios`, olvida los eventos procesados del proyector
// y rebobina sus offsets. El proyector tiene que estar DETENIDO.
import { createKafka, connectMongo, GROUPS, GROUP_TOPICS } from '../src/index.js';

const { client, db } = await connectMongo();
await db.collection('envios').deleteMany({});
await db.collection('alertas').deleteMany({});
await db.collection('notificaciones').deleteMany({});
await db.collection('eventos_procesados').deleteMany({ consumidor: GROUPS.PROYECTOR });

const admin = createKafka('reset-tool').admin();
await admin.connect();
for (const topic of GROUP_TOPICS[GROUPS.PROYECTOR]) {
  await admin.resetOffsets({ groupId: GROUPS.PROYECTOR, topic, earliest: true });
}
await admin.disconnect();
await client.close();
console.log('Proyección borrada y offsets rebobinados. Arrancá el proyector para reconstruir.');
