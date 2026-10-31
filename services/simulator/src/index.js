import http from 'node:http';
import { createKafka, logger } from '@rutasur/shared';
import { config } from './config.js';
import { createSim, ESCENARIOS } from './sim.js';

const log = logger('simulador');
let publish;

if (process.env.DRY_RUN) {
  publish = async (msgs) => msgs.forEach((m) => console.log(m.topic, m.key, m.value));
} else {
  const producer = createKafka('simulador').producer();
  await producer.connect();
  publish = async (msgs) => {
    const porTopic = new Map();
    for (const m of msgs) {
      if (!porTopic.has(m.topic)) porTopic.set(m.topic, []);
      porTopic.get(m.topic).push({ key: m.key, value: m.value });
    }
    await producer.sendBatch({
      topicMessages: [...porTopic].map(([topic, messages]) => ({ topic, messages })),
    });
  };
}

const sim = createSim(config, publish);

let ocupado = false;
const timer = setInterval(async () => {
  if (ocupado) return;
  ocupado = true;
  try { await sim.tick(1000); } catch (e) { log('error en tick', { error: e.message }); }
  ocupado = false;
}, 1000);

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const json = (code, body) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

  const m = url.pathname.match(/^\/scenarios\/([\w-]+)$/);
  if (req.method === 'POST' && m) {
    try { sim.scenario(m[1]); log('escenario lanzado', { escenario: m[1] }); return json(202, { ok: true, escenario: m[1] }); }
    catch (e) { return json(404, { ok: false, error: e.message, disponibles: ESCENARIOS }); }
  }
  if (url.pathname === '/health') return json(200, { ok: true, ...sim.stats() });
  json(404, { error: 'not found' });
}).listen(config.port, () => log('simulador listo', { puerto: config.port, escenarios: ESCENARIOS, ...config }));

process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
