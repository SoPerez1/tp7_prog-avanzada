'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  MapPin,
  User,
  RotateCcw,
  Calendar,
  ExternalLink,
  ShieldAlert,
  Clock,
  RefreshCw,
  Mail
} from 'lucide-react';

export default function DetalleEnvioPage({ params }) {
  const [envio, setEnvio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarEnvio = async () => {
    try {
      const res = await fetch(`/api/shipments/${params.id}`);
      if (!res.ok) throw new Error('Envío no encontrado');
      const json = await res.json();
      setEnvio(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarEnvio();
    const evtSource = new EventSource('/api/stream');
    evtSource.addEventListener('envio_actualizado', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.doc?.shipmentId === params.id) {
          cargarEnvio();
        }
      } catch (err) {}
    });
    return () => evtSource.close();
  }, [params.id]);

  if (cargando) {
    return (
      <div className="p-24 text-center text-rose-400 font-mono text-xs flex flex-col items-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
        Cargando ficha operativa...
      </div>
    );
  }

  if (error || !envio) {
    return (
      <div className="max-w-md mx-auto p-12 text-center text-rose-600 space-y-4">
        <p className="text-sm font-semibold">{error ?? 'Paquete no encontrado'}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-rose-600 hover:text-rose-800 transition font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Torre de Control
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-rose-100 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 text-slate-700 hover:text-rose-600 text-xs font-medium transition shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-rose-500" />
          Volver a Torre de Control
        </Link>

        <Link
          href={`/tracking?id=${envio.shipmentId}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-bold transition"
        >
          Ver en Tracking Público
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Main Title Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-rose-100 space-y-5 shadow-sm bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-rose-500 font-semibold">
              Identificador Único
            </span>
            <h1 className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
              {envio.shipmentId}
            </h1>
          </div>
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 self-start sm:self-auto shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            {envio.estado}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-rose-50/40 p-4 rounded-2xl border border-rose-100 text-xs">
          <div>
            <span className="text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-400" /> Hub / Zona
            </span>
            <p className="font-bold text-slate-900 mt-0.5 font-mono">
              {envio.hubId} / {envio.zonaId}
            </p>
          </div>
          <div>
            <span className="text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3 text-rose-400" /> Repartidor
            </span>
            <p className="font-bold text-slate-900 mt-0.5 font-mono">
              {envio.repartidorId ?? 'Sin asignar'}
            </p>
          </div>
          <div>
            <span className="text-slate-500 flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-rose-400" /> Intentos
            </span>
            <p className="font-bold text-slate-900 mt-0.5 font-mono">
              {envio.intentos ?? 1} de 3
            </p>
          </div>
          <div>
            <span className="text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-rose-400" /> Promesa SLA
            </span>
            <p className="font-bold text-slate-900 mt-0.5 font-mono">
              {envio.promesa?.venceEn ? new Date(envio.promesa.venceEn).toLocaleTimeString() : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Rescheduling Decision (CU2) */}
      {envio.reprogramacion && (
        <div className="p-5 bg-pink-50/70 border border-pink-200 rounded-3xl space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-pink-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-pink-600" />
              Decisión de Reprogramación (CU2)
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-800 font-mono font-bold border border-pink-200">
              {envio.reprogramacion.accion}
            </span>
          </div>
          <p className="text-xs text-slate-700">
            Causa del fallo: <span className="font-bold text-rose-600">{envio.reprogramacion.motivo}</span>
          </p>
          {envio.reprogramacion.proximoIntento && (
            <p className="text-xs text-rose-700 font-mono">
              Próximo intento programado:{' '}
              <strong className="underline">
                {new Date(envio.reprogramacion.proximoIntento).toLocaleDateString()} (Franja: {envio.reprogramacion.franja})
              </strong>
            </p>
          )}
        </div>
      )}

      {/* Timeline Section */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-rose-100 space-y-4 shadow-sm bg-white">
        <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-rose-500">
          Línea de Tiempo del Event Log
        </h3>
        <div className="space-y-4 border-l-2 border-rose-200 pl-4 ml-2">
          {(envio.historial ?? []).map((h, i) => (
            <div key={i} className="relative text-xs">
              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-white" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{h.tipo}</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {h.ocurridoEn ? new Date(h.ocurridoEn).toLocaleTimeString() : '-'}
                </span>
              </div>
              {h.motivo && <span className="text-[11px] text-rose-600 font-medium">Motivo: {h.motivo} </span>}
              {h.intento && <span className="text-[11px] text-slate-500 ml-2">(Intento {h.intento})</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
