import { connectMongo } from '@rutasur/shared';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let client, db;
  try {
    const mongo = await connectMongo();
    client = mongo.client;
    db = mongo.db;
  } catch (err) {
    return new Response(`Error conectando a MongoDB: ${err.message}`, { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event, data) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream cerrado
        }
      };

      // Notificación inicial de conexión
      sendEvent('connected', { timestamp: new Date().toISOString() });

      let enviosStream = null;
      let alertasStream = null;
      let pingInterval = null;

      try {
        // Change Stream para la colección `envios` con updateLookup
        enviosStream = db.collection('envios').watch([], { fullDocument: 'updateLookup' });
        enviosStream.on('change', (change) => {
          sendEvent('envio_actualizado', {
            operacion: change.operationType,
            shipmentId: change.documentKey?._id,
            doc: change.fullDocument,
            timestamp: new Date().toISOString(),
          });
        });
        enviosStream.on('error', (err) => {
          console.error('[SSE] Error en Change Stream de envios:', err);
        });

        // Change Stream para la colección `alertas`
        alertasStream = db.collection('alertas').watch([], { fullDocument: 'updateLookup' });
        alertasStream.on('change', (change) => {
          sendEvent('alerta_actualizada', {
            operacion: change.operationType,
            alertaId: change.documentKey?._id,
            doc: change.fullDocument,
            timestamp: new Date().toISOString(),
          });
        });
        alertasStream.on('error', (err) => {
          console.error('[SSE] Error en Change Stream de alertas:', err);
        });

        // Heartbeat cada 15 segundos
        pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            clearInterval(pingInterval);
          }
        }, 15000);

        request.signal.addEventListener('abort', async () => {
          clearInterval(pingInterval);
          if (enviosStream) await enviosStream.close().catch(() => {});
          if (alertasStream) await alertasStream.close().catch(() => {});
          try {
            controller.close();
          } catch {}
        });
      } catch (err) {
        console.error('[SSE] Error iniciando change streams:', err);
        sendEvent('error', { error: err.message });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

