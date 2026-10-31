// Muestra el lag de cada grupo de consumidores: node bin/lag.js
import { createKafka, GROUP_TOPICS } from '../src/index.js';

const admin = createKafka('lag-tool').admin();
await admin.connect();

const filas = [];
for (const [groupId, topics] of Object.entries(GROUP_TOPICS)) {
  const committed = await admin.fetchOffsets({ groupId, topics });
  for (const { topic, partitions } of committed) {
    const end = await admin.fetchTopicOffsets(topic);
    for (const p of partitions) {
      const e = end.find((x) => x.partition === p.partition);
      const actual = Number(p.offset) < 0 ? Number(e.low) : Number(p.offset);
      filas.push({ grupo: groupId, topic, particion: p.partition, offset: p.offset, fin: e.high, lag: Number(e.high) - actual });
    }
  }
}
console.table(filas);
await admin.disconnect();
