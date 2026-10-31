import { z } from 'zod';
import { TOPICS } from './topics.js';

export const ESTADOS = [
  'CREADO', 'INGRESADO_HUB', 'CLASIFICADO', 'EN_REPARTO', 'ENTREGADO', 'ENTREGA_FALLIDA',
];
export const MOTIVOS = ['AUSENTE', 'DIRECCION_INCORRECTA', 'RECHAZADO', 'ZONA_INACCESIBLE'];
export const ACCIONES_REPROGRAMACION = ['REPROGRAMADO', 'RETENIDO', 'DEVOLUCION'];
export const REGLAS_SLA = ['SIN_INGRESO', 'SIN_SALIDA', 'FALLO_DIA_LIMITE', 'VENCIDO'];
export const PRIORIDADES_SLA = ['MEDIA', 'ALTA', 'CRITICA'];

const base = {
  eventId: z.string().min(1),
  shipmentId: z.string().min(1),
  ocurridoEn: z.string().datetime(),
  secuencia: z.number().int().positive().optional(),
  version: z.literal(1).default(1),
  hubId: z.string().min(1),
  zonaId: z.string().min(1),
};

export const estadoSchema = z
  .object({
    ...base,
    secuencia: z.number().int().positive(),
    tipo: z.enum(ESTADOS),
    repartidorId: z.string().nullable(),
    intento: z.number().int().min(1).max(3),
    motivo: z.enum(MOTIVOS).optional(),
  })
  .superRefine((ev, ctx) => {
    if (ev.tipo === 'ENTREGA_FALLIDA' && !ev.motivo) {
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'ENTREGA_FALLIDA requiere motivo' });
    }
  });

export const promesaSchema = z.object({
  ...base,
  secuencia: z.number().int().positive(),
  tipo: z.literal('PROMESA'),
  venceEn: z.string().datetime(),
});

export const reprogramacionSchema = z.object({
  ...base,
  tipo: z.string().default('REPROGRAMACION'),
  accion: z.enum(ACCIONES_REPROGRAMACION),
  motivo: z.string().optional().nullable(),
  intento: z.number().int().min(1).max(3),
  proximoIntento: z.string().datetime().optional().nullable(),
  franja: z.enum(['MANANA', 'TARDE']).optional().nullable(),
});

export const alertaSchema = z.object({
  ...base,
  tipo: z.enum(['ALERTA_SLA', 'CIERRE_ALERTA']).default('ALERTA_SLA'),
  estado: z.enum(['ABIERTA', 'CERRADA']),
  regla: z.enum(REGLAS_SLA),
  prioridad: z.enum(PRIORIDADES_SLA),
  causa: z.string(),
});

export const notificacionSchema = z.object({
  ...base,
  tipo: z.string().default('NOTIFICACION'),
  canal: z.enum(['EMAIL', 'SMS', 'WHATSAPP']).default('EMAIL'),
  destinatario: z.string().min(1),
  mensaje: z.string().min(1),
  opciones: z.array(z.string()).optional(),
});

export const SCHEMAS = {
  [TOPICS.ESTADOS]: estadoSchema,
  [TOPICS.PROMESAS]: promesaSchema,
  [TOPICS.REPROGRAMACIONES]: reprogramacionSchema,
  [TOPICS.ALERTAS]: alertaSchema,
  [TOPICS.NOTIFICACIONES]: notificacionSchema,
};
