const num = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);

export const config = {
  seed: num('SEED', 42),
  enviosPorMinuto: num('ENVIOS_POR_MINUTO', 20),
  aceleracion: num('ACELERACION', 120),          // 1 h simulada = 30 s reales
  simStart: process.env.SIM_START ?? '2026-11-02T06:00:00.000Z', // un lunes
  promesaHoras: num('PROMESA_HORAS', 24),
  prefix: process.env.SHIPMENT_PREFIX ?? 'RS',
  port: num('SIM_PORT', 4000),

  pDemoraHub: num('P_DEMORA_HUB', 0.10),
  pDuplicado: num('P_DUPLICADO', 0.02),
  pFueraDeOrden: num('P_FUERA_DE_ORDEN', 0.02),
  pMalformado: num('P_MALFORMADO', 0.01),

  motivos: [['AUSENTE', 0.60], ['DIRECCION_INCORRECTA', 0.20], ['RECHAZADO', 0.15], ['ZONA_INACCESIBLE', 0.05]],

  // 3 hubs, 2 zonas por hub, tasas de fallo entre 5% y 30%
  zonas: [
    { id: 'Z1', hub: 'HUB-A', pFallo: 0.05 },
    { id: 'Z2', hub: 'HUB-A', pFallo: 0.10 },
    { id: 'Z3', hub: 'HUB-B', pFallo: 0.15 },
    { id: 'Z4', hub: 'HUB-B', pFallo: 0.20 },
    { id: 'Z5', hub: 'HUB-C', pFallo: 0.25 },
    { id: 'Z6', hub: 'HUB-C', pFallo: 0.30 },
  ],
};
