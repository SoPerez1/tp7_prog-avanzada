export const dynamic = 'force-dynamic';

const SIMULATOR_URL = process.env.SIMULATOR_URL ?? 'http://localhost:4000';

export async function GET() {
  try {
    const res = await fetch(`${SIMULATOR_URL}/health`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ status: 'offline', error: err.message }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const escenario = body.escenario;

    const res = await fetch(`${SIMULATOR_URL}/scenarios/${escenario}`, {
      method: 'POST',
    });
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

