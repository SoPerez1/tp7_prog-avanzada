export const TOPICS = {
  ESTADOS: 'envios.estados',
  PROMESAS: 'envios.promesas',
  REPROGRAMACIONES: 'envios.reprogramaciones',
  ALERTAS: 'alertas.sla',
  NOTIFICACIONES: 'notificaciones.enviadas',
  DLQ: 'envios.estados.dlq',
};

export const GROUPS = {
  PROYECTOR: 'proyector',
  NOTIFICACIONES: 'notificaciones',
  REPROGRAMACION: 'reprogramacion',
  MONITOR_SLA: 'monitor-sla',
  ANALITICA: 'analitica',
  ANALITICA_REPLAY: 'analitica-replay',
};

// Topics que lee cada grupo (se usa para calcular el lag)
export const GROUP_TOPICS = {
  [GROUPS.PROYECTOR]: [
    TOPICS.ESTADOS,
    TOPICS.PROMESAS,
    TOPICS.REPROGRAMACIONES,
    TOPICS.ALERTAS,
    TOPICS.NOTIFICACIONES,
  ],
  [GROUPS.NOTIFICACIONES]: [TOPICS.ESTADOS, TOPICS.ALERTAS],
  [GROUPS.REPROGRAMACION]: [TOPICS.ESTADOS],
  [GROUPS.MONITOR_SLA]: [TOPICS.ESTADOS, TOPICS.PROMESAS],
  [GROUPS.ANALITICA]: [TOPICS.ESTADOS, TOPICS.PROMESAS],
  [GROUPS.ANALITICA_REPLAY]: [TOPICS.ESTADOS],
};
