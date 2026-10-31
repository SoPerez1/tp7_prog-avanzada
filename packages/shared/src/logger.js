export const logger = (svc) => (msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), svc, msg, ...extra }));
