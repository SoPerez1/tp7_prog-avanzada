'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

function TrackingContent() {
  const searchParams = useSearchParams();
  const idInicial = searchParams.get('id') ?? '';
  const [queryId, setQueryId] = useState(idInicial);
  const [envio, setEnvio] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const buscarEnvio = async (idABuscar) => {
    const id = idABuscar || queryId;
    if (!id.trim()) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(id.trim())}?public=true`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('No encontramos un paquete con ese código de seguimiento.');
        throw new Error('Error al consultar el seguimiento.');
      }
      const json = await res.json();
      setEnvio(json);
    } catch (e) {
      setError(e.message);
      setEnvio(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (idInicial) {
      buscarEnvio(idInicial);
    }
  }, [idInicial]);

  // Actualización en vivo vía SSE si estamos viendo un paquete
  useEffect(() => {
    if (!envio?.shipmentId) return;

    const evtSource = new EventSource('/api/stream');
    evtSource.addEventListener('envio_actualizado', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.doc?.shipmentId === envio.shipmentId) {
          buscarEnvio(envio.shipmentId);
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => evtSource.close();
  }, [envio?.shipmentId]);

  // Pasos del ciclo de vida para el tracking del cliente
  const pasos = [
    { key: 'CREADO', label: 'Confirmado' },
    { key: 'INGRESADO_HUB', label: 'En Depósito' },
    { key: 'CLASIFICADO', label: 'Preparado' },
    { key: 'EN_REPARTO', label: 'En Camino' },
    { key: 'ENTREGADO', label: 'Entregado' },
  ];

  const getPasoActual = (estado) => {
    switch (estado) {
      case 'CREADO': return 0;
      case 'INGRESADO_HUB': return 1;
      case 'CLASIFICADO': return 2;
      case 'EN_REPARTO': return 3;
      case 'ENTREGADO': return 4;
      case 'ENTREGA_FALLIDA': return 3;
      default: return 0;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4 sm:py-8">
      {/* Hero Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold mb-1 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
          Portal Público de Destinatarios
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Seguimiento de tu Envío
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
          Ingresá el número de seguimiento para conocer el estado y fecha estimada de tu paquete
        </p>
      </div>

      {/* Search Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          buscarEnvio();
        }}
        className="relative"
      >
        <div className="flex gap-2 p-1.5 bg-white border border-rose-200 rounded-2xl shadow-sm focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100 transition">
          <div className="relative flex-1 flex items-center pl-3">
            <Search className="w-4 h-4 text-rose-400 mr-2.5" />
            <input
              type="text"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="Ej: RS-000001"
              className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm font-mono focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-200 disabled:opacity-50 flex items-center gap-2"
          >
            {cargando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Rastrear'}
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="flex items-center gap-2 mt-2 px-1 text-[11px] text-slate-500 font-mono">
          <span className="text-slate-400">Ejemplos:</span>
          {['RS-000001', 'RS-000002', 'RS-000003'].map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => {
                setQueryId(sug);
                buscarEnvio(sug);
              }}
              className="text-rose-600 hover:text-rose-800 hover:underline font-medium"
            >
              {sug}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2 text-center justify-center">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Shipment Status Card */}
      {envio && (
        <div className="glass-card rounded-3xl border border-rose-100 p-6 sm:p-8 space-y-8 shadow-sm bg-white animate-in fade-in duration-200">
          {/* Top Row: Shipment ID & State */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100 pb-6">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-rose-500 font-semibold">
                Identificador de Paquete
              </span>
              <h2 className="text-3xl font-black font-mono text-slate-900 mt-0.5">
                {envio.shipmentId}
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[11px] text-slate-500 block">Estado actual:</span>
              <div className="text-sm sm:text-base font-bold text-rose-600 flex items-center gap-2 sm:justify-end mt-0.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                {envio.estadoPublico}
              </div>
            </div>
          </div>

          {/* Visual Step Progress Bar */}
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
              {pasos.map((p, idx) => {
                const currentIdx = getPasoActual(envio.estado);
                const isPassed = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div key={p.key} className="space-y-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isPassed
                          ? 'bg-rose-500 shadow-xs shadow-rose-200'
                          : 'bg-rose-100'
                      }`}
                    />
                    <span
                      className={`font-semibold block ${
                        isCurrent
                          ? 'text-rose-600 font-bold'
                          : isPassed
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {p.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estimated Date Card */}
          <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-rose-200 flex items-center justify-center text-rose-500 shadow-2xs flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Fecha estimada de entrega:</span>
                <p className="text-base font-bold text-slate-900 capitalize">
                  {envio.fechaEstimada
                    ? new Date(envio.fechaEstimada).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'En programación'}
                </p>
              </div>
            </div>
            {envio.franjaEstimada && (
              <span className="px-3.5 py-1 rounded-full bg-white border border-rose-200 text-xs font-semibold text-rose-700 shadow-2xs self-start sm:self-auto">
                Franja: {envio.franjaEstimada === 'MANANA' ? 'Mañana (9:00 a 13:00)' : 'Tarde (14:00 a 18:00)'}
              </span>
            )}
          </div>

          {/* Public Timeline History */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 font-mono">
              Historial de Actualizaciones
            </h3>
            <div className="space-y-4 border-l-2 border-rose-200 pl-4 ml-2">
              {envio.historialPublico?.map((h, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-white" />
                  <div className="text-xs sm:text-sm font-bold text-slate-800">
                    {h.tipo}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {h.ocurridoEn ? new Date(h.ocurridoEn).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackingPublico() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-rose-400 font-mono text-xs">Cargando buscador...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
