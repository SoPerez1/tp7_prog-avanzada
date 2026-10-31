import { TOPICS } from '@rutasur/shared';
import { makeRng } from './rng.js';

const M = 60e3;
const H = 3600e3;
export const ESCENARIOS = ['feliz', 'ausente', 'demorado', 'tercer-fallo', 'rafaga'];

/**
 * Simulador determinista: avanza un reloj simulado en cada tick y emite los eventos
 * que "vencen". La aleatoriedad sale solo de la semilla, no de Date.now().
 * publish(mensajes) recibe [{ topic, key, value }].
 */
export function createSim(cfg, publish) {
  const rng = makeRng(cfg.seed);
  let now = Date.parse(cfg.simStart);
  let counter = 0, carry = 0, malformados = 0;
  const agenda = [];        // { at, fn }
  const out = [];           // eventos pendientes de publicar en este tick
  const held = new Map();   // shipmentId -> mensaje retenido (para simular fuera de orden)
  const pendientes = [];    // escenarios pedidos por HTTP

  const iso = (t) => new Date(t).toISOString();
  const schedule = (at, fn) => { agenda.push({ at, fn }); agenda.sort((a, b) => a.at - b.at); };

  function emit(s, at, tipo, extra = {}, { last = false } = {}) {
    s.seq += 1;
    out.push({
      topic: TOPICS.ESTADOS,
      last,
      noise: !s.opts.noNoise,
      ev: {
        eventId: `evt_${s.id}_${s.seq}`,
        shipmentId: s.id,
        tipo,
        ocurridoEn: iso(at),
        secuencia: s.seq,
        hubId: s.zona.hub,
        zonaId: s.zona.id,
        repartidorId: s.repartidor,
        intento: s.intento,
        version: 1,
        ...extra,
      },
    });
  }

  // Siguiente día hábil, en la franja opuesta a la del fallo
  function proximoIntento(at, franja) {
    const d = new Date(at);
    do { d.setUTCDate(d.getUTCDate() + 1); } while ([0, 6].includes(d.getUTCDay()));
    d.setUTCHours(franja === 'MANANA' ? 15 : 9, 0, 0, 0);
    return d.getTime();
  }

  function nuevoEnvio(at, opts = {}) {
    const zona = opts.zona ?? rng.pick(cfg.zonas);
    const s = {
      id: `${cfg.prefix}-${String(++counter).padStart(6, '0')}`,
      zona, repartidor: null, seq: 0, intento: 1, opts,
      demora: !opts.gapMs && rng.chance(cfg.pDemoraHub),
    };
    const gaps = {
      ingreso: () => (s.demora ? rng.int(15 * H, 19 * H) : rng.int(1 * H, 3 * H)),
      clasificar: () => rng.int(30 * M, 90 * M),
      salir: () => rng.int(1 * H, 3 * H),
      resultado: () => rng.int(1 * H, 4 * H),
    };
    const gap = (k) => opts.gapMs ?? gaps[k]();

    const ingresar = (t) => {
      emit(s, t, 'INGRESADO_HUB');
      if (opts.stopAfter === 'INGRESADO_HUB') return;
      schedule(t + gap('clasificar'), clasificar);
    };
    const clasificar = (t) => {
      s.repartidor = `R-${zona.hub.slice(-1)}-${String(rng.int(1, 40)).padStart(2, '0')}`;
      emit(s, t, 'CLASIFICADO');
      schedule(t + gap('salir'), salir);
    };
    const salir = (t) => {
      emit(s, t, 'EN_REPARTO');
      schedule(t + gap('resultado'), resultado);
    };
    const resultado = (t) => {
      const franja = new Date(t).getUTCHours() < 13 ? 'MANANA' : 'TARDE';
      let salida = opts.forced?.[s.intento - 1];
      if (!salida) {
        const p = Math.min(0.6, zona.pFallo * (franja === 'MANANA' ? 1.3 : 0.8)); // la mañana falla más
        salida = rng.chance(p) ? rng.weighted(cfg.motivos) : 'OK';
      }
      if (salida === 'OK') return emit(s, t, 'ENTREGADO', {}, { last: true });

      // El "mundo" simulado: ausente / zona inaccesible reintentan; dirección incorrecta,
      // rechazo o 3er fallo terminan el circuito (la decisión formal la toma el servicio de reprogramación)
      const reintenta = s.intento < 3 && (salida === 'AUSENTE' || salida === 'ZONA_INACCESIBLE');
      emit(s, t, 'ENTREGA_FALLIDA', { motivo: salida }, { last: !reintenta });
      if (reintenta) {
        s.intento += 1;
        schedule(opts.gapMs ? t + opts.gapMs : proximoIntento(t, franja), clasificar);
      }
    };

    emit(s, at, 'CREADO');
    out.push({
      topic: TOPICS.PROMESAS, noise: false, last: false,
      ev: {
        eventId: `prm_${s.id}`, shipmentId: s.id, tipo: 'PROMESA', ocurridoEn: iso(at),
        secuencia: 1, version: 1, hubId: zona.hub, zonaId: zona.id,
        venceEn: iso(at + (opts.venceMs ?? cfg.promesaHoras * H)),
      },
    });
    schedule(at + gap('ingreso'), ingresar);
  }

  function malformado(ev) {
    const id = `evt_${ev.shipmentId}_bad${++malformados}`;
    const variantes = [
      { ...ev, eventId: id, tipo: 'TELEPORTADO' },
      { ...ev, eventId: id, ocurridoEn: 'ayer' },
      { ...ev, eventId: id, secuencia: 'uno' },
      { ...ev, eventId: id, tipo: 'ENTREGA_FALLIDA', motivo: undefined },
      (({ shipmentId, ...resto }) => ({ ...resto, eventId: id }))(ev),
    ];
    const i = rng.int(0, variantes.length); // el índice extra = JSON roto
    const value = i === variantes.length ? '{"roto": ' : JSON.stringify(variantes[i]);
    return { topic: TOPICS.ESTADOS, key: ev.shipmentId, value };
  }

  // Aplica duplicados, desorden y malformados sobre lo producido en el tick
  function armar(items) {
    const msgs = [];
    for (const { topic, ev, last, noise } of items) {
      const m = { topic, key: ev.shipmentId, value: JSON.stringify(ev) };
      const esEstado = topic === TOPICS.ESTADOS;
      if (esEstado && noise && !last && !held.has(ev.shipmentId) && rng.chance(cfg.pFueraDeOrden)) {
        held.set(ev.shipmentId, m); // se publica recién después del evento siguiente
        continue;
      }
      msgs.push(m);
      if (noise && rng.chance(cfg.pDuplicado)) msgs.push(m);
      if (esEstado && held.has(ev.shipmentId)) {
        msgs.push(held.get(ev.shipmentId));
        held.delete(ev.shipmentId);
      }
      if (esEstado && noise && rng.chance(cfg.pMalformado)) msgs.push(malformado(ev));
    }
    return msgs;
  }

  function lanzar(nombre) {
    const base = { noNoise: true, gapMs: 20 * M }; // escenarios: sin ruido y comprimidos (~10 s reales por estado)
    switch (nombre) {
      case 'feliz': return nuevoEnvio(now, { ...base, forced: ['OK'] });
      case 'ausente': return nuevoEnvio(now, { ...base, forced: ['AUSENTE', 'OK'] });
      case 'tercer-fallo': return nuevoEnvio(now, { ...base, forced: ['AUSENTE', 'AUSENTE', 'AUSENTE'] });
      case 'demorado': return nuevoEnvio(now, { ...base, venceEn: undefined, venceMs: 5 * H, stopAfter: 'INGRESADO_HUB' });
      case 'rafaga': for (let i = 0; i < 500; i++) nuevoEnvio(now); return;
    }
  }

  return {
    scenario(nombre) {
      if (!ESCENARIOS.includes(nombre)) throw new Error(`escenario desconocido: ${nombre}`);
      pendientes.push(nombre);
    },
    stats: () => ({ simNow: iso(now), enviosCreados: counter, agendados: agenda.length }),
    async tick(realMs = 1000) {
      now += realMs * cfg.aceleracion;
      while (pendientes.length) lanzar(pendientes.shift());
      carry += (cfg.enviosPorMinuto * realMs) / 60000;
      while (carry >= 1) { carry -= 1; nuevoEnvio(now); }
      while (agenda.length && agenda[0].at <= now) {
        const { at, fn } = agenda.shift();
        fn(at);
      }
      const msgs = armar(out.splice(0));
      if (msgs.length) await publish(msgs);
    },
  };
}
