/**
 * Calcula el próximo día hábil en la franja opuesta a la del fallo.
 * Si falló a la mañana (<13h UTC), reprograma a la tarde (15h UTC).
 * Si falló a la tarde (>=13h UTC), reprograma a la mañana (09h UTC).
 * Saltea sábados y domingos.
 */
export function proximoIntentoLaboral(ocurridoEn) {
  const d = new Date(ocurridoEn);
  const franjaFallo = d.getUTCHours() < 13 ? 'MANANA' : 'TARDE';
  const franjaOpuesta = franjaFallo === 'MANANA' ? 'TARDE' : 'MANANA';

  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while ([0, 6].includes(d.getUTCDay()));

  d.setUTCHours(franjaOpuesta === 'MANANA' ? 9 : 15, 0, 0, 0);
  return {
    fecha: d.toISOString(),
    franja: franjaOpuesta,
  };
}

/**
 * Generadores deterministas de eventId para garantizar idempotencia 'exactamente una vez'
 * ante reintentos de consumidores con entrega 'al menos una vez'.
 */
export function eventIdNotificacion(triggerEventId) {
  return `notif_${triggerEventId}`;
}

export function eventIdReprogramacion(triggerEventId) {
  return `reprog_${triggerEventId}`;
}

