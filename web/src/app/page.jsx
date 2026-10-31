'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  Search,
  Filter,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Inbox,
  Calendar,
  User,
  MapPin,
  RotateCcw
} from 'lucide-react';

export default function TorreDeControl() {
  const [data, setData] = useState(null);
  const [latenciaMs, setLatenciaMs] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [envioSeleccionado, setEnvioSeleccionado] = useState(null);
  const [detalleEnvio, setDetalleEnvio] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cargarDatos = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/shipments?limit=100');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Error cargando envíos:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    // Conexión Server-Sent Events (SSE) a Change Streams de MongoDB
    const evtSource = new EventSource('/api/stream');

    evtSource.addEventListener('envio_actualizado', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const ahora = Date.now();
        if (payload.doc?.actualizadoEn) {
          const lat = ahora - Date.parse(payload.doc.actualizadoEn);
          if (lat >= 0 && lat < 30000) setLatenciaMs(lat);
        }

        setData((prev) => {
          if (!prev) return prev;
          const index = prev.envios.findIndex((x) => x.shipmentId === payload.doc.shipmentId);
          let nuevosEnvios;
          if (index >= 0) {
            nuevosEnvios = [...prev.envios];
            nuevosEnvios[index] = payload.doc;
          } else {
            nuevosEnvios = [payload.doc, ...prev.envios.slice(0, 99)];
          }

          const contadores = { ...prev.contadores };
          if (payload.doc.estado && contadores[payload.doc.estado] !== undefined) {
            contadores[payload.doc.estado] = (contadores[payload.doc.estado] ?? 0) + 1;
          }

          return { ...prev, envios: nuevosEnvios, contadores };
        });

        // Actualizar modal si está abierto con ese shipment
        setEnvioSeleccionado((actual) => {
          if (actual?.shipmentId === payload.doc.shipmentId) {
            return payload.doc;
          }
          return actual;
        });
      } catch (err) {
        console.error('Error procesando evento SSE envio:', err);
      }
    });

    evtSource.addEventListener('alerta_actualizada', (e) => {
      try {
        const payload = JSON.parse(e.data);
        setData((prev) => {
          if (!prev) return prev;
          let nuevasAlertas = [...prev.alertas];
          const index = nuevasAlertas.findIndex((x) => x._id === payload.alertaId);

          if (payload.doc.estado === 'CERRADA') {
            nuevasAlertas = nuevasAlertas.filter((x) => x._id !== payload.alertaId);
          } else if (index >= 0) {
            nuevasAlertas[index] = payload.doc;
          } else {
            nuevasAlertas = [payload.doc, ...nuevasAlertas];
          }

          return {
            ...prev,
            alertas: nuevasAlertas,
            contadores: { ...prev.contadores, ALERTAS_ABIERTAS: nuevasAlertas.length },
          };
        });
      } catch (err) {
        console.error('Error procesando evento SSE alerta:', err);
      }
    });

    return () => evtSource.close();
  }, []);

  const abrirDetalle = async (envio) => {
    setEnvioSeleccionado(envio);
    setCargandoDetalle(true);
    try {
      const res = await fetch(`/api/shipments/${envio.shipmentId}`);
      const json = await res.json();
      setDetalleEnvio(json);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const enviosFiltrados = useMemo(() => {
    if (!data?.envios) return [];
    let list = data.envios;
    if (filtroEstado !== 'TODOS') {
      list = list.filter((e) => e.estado === filtroEstado);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.shipmentId?.toLowerCase().includes(q) ||
          e.zonaId?.toLowerCase().includes(q) ||
          e.hubId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, filtroEstado, busqueda]);

  const badgeEstado = (estado) => {
    switch (estado) {
      case 'ENTREGADO':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Entregado',
        };
      case 'EN_REPARTO':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500 animate-pulse',
          label: 'En Reparto',
        };
      case 'ENTREGA_FALLIDA':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
          label: 'Fallido',
        };
      case 'CLASIFICADO':
        return {
          bg: 'bg-pink-50 text-pink-700 border-pink-200',
          dot: 'bg-pink-500',
          label: 'Clasificado',
        };
      case 'INGRESADO_HUB':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          label: 'En Hub',
        };
      case 'CREADO':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: 'Creado',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: estado,
        };
    }
  };

  const badgePrioridad = (prio) => {
    switch (prio) {
      case 'CRITICA':
        return 'bg-rose-600 text-white font-bold animate-pulse shadow-xs';
      case 'ALTA':
        return 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold';
      case 'MEDIA':
        return 'bg-pink-100 text-pink-800 border border-pink-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Overview & Latency SLA */}
      <div className="glass-card rounded-2xl p-6 border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm bg-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Torre de Control
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-50 text-rose-600 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              EN VIVO
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitoreo en tiempo real del ciclo de vida y cola de alertas SLA
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Latency Pill (< 2s SLA) */}
          <div className="px-3.5 py-2 rounded-xl bg-rose-50/70 border border-rose-200 text-xs font-mono flex items-center gap-2.5 text-slate-700">
            <span className="text-slate-500">Latencia evento-pantalla:</span>
            <span
              className={`font-bold ${
                latenciaMs !== null && latenciaMs < 2000
                  ? 'text-rose-600'
                  : 'text-amber-600'
              }`}
            >
              {latenciaMs !== null ? `${latenciaMs} ms` : '< 200 ms'}
            </span>
            <span className="text-[10px] text-rose-400 font-sans hidden md:inline font-semibold">
              (SLA &lt; 2s)
            </span>
          </div>

          <button
            onClick={cargarDatos}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-slate-600 hover:text-rose-600 transition shadow-xs disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Envíos', val: data?.contadores.TOTAL ?? 0, k: 'TODOS', color: 'hover:border-rose-300' },
          { label: 'Creados', val: data?.contadores.CREADO ?? 0, k: 'CREADO', color: 'hover:border-slate-300' },
          { label: 'En Hub', val: data?.contadores.INGRESADO_HUB ?? 0, k: 'INGRESADO_HUB', color: 'hover:border-amber-300' },
          { label: 'Clasificados', val: data?.contadores.CLASIFICADO ?? 0, k: 'CLASIFICADO', color: 'hover:border-purple-300' },
          { label: 'En Reparto', val: data?.contadores.EN_REPARTO ?? 0, k: 'EN_REPARTO', color: 'hover:border-pink-300' },
          { label: 'Entregados', val: data?.contadores.ENTREGADO ?? 0, k: 'ENTREGADO', color: 'hover:border-emerald-300' },
          { label: 'Fallidos', val: data?.contadores.ENTREGA_FALLIDA ?? 0, k: 'ENTREGA_FALLIDA', color: 'hover:border-rose-400' },
        ].map((item) => {
          const isSelected = filtroEstado === item.k;
          return (
            <button
              key={item.k}
              onClick={() => setFiltroEstado(item.k)}
              className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden group shadow-xs ${
                isSelected
                  ? 'bg-rose-50/80 border-rose-400 text-rose-950 shadow-md ring-2 ring-rose-200'
                  : 'bg-white border-rose-100 ' + item.color + ' hover:bg-rose-50/30'
              }`}
            >
              <div className="text-[11px] font-medium text-slate-500 truncate tracking-wide">
                {item.label}
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {item.val}
              </div>
              {isSelected && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-rose-400/20 to-transparent pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Shipments Table */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-rose-100 flex flex-col overflow-hidden shadow-sm bg-white">
          {/* Table Header & Search */}
          <div className="p-4 sm:p-5 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">
                Flujo de Envíos en Tiempo Real
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-mono font-medium border border-rose-100">
                {enviosFiltrados.length}
              </span>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por ID, zona..."
                className="w-full bg-rose-50/30 border border-rose-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto flex-1 max-h-[540px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/60 text-slate-700 border-b border-rose-100 sticky top-0 backdrop-blur-sm z-10 font-mono text-[11px]">
                <tr>
                  <th className="p-3.5 pl-5">Envío ID</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5">Zona / Hub</th>
                  <th className="p-3.5 text-center">Intentos</th>
                  <th className="p-3.5">Riesgo SLA</th>
                  <th className="p-3.5 text-right pr-5">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/70">
                {enviosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-rose-300" />
                      No hay envíos registrados en este filtro todavía.
                    </td>
                  </tr>
                ) : (
                  enviosFiltrados.map((e) => {
                    const status = badgeEstado(e.estado);
                    return (
                      <tr
                        key={e.shipmentId}
                        onClick={() => abrirDetalle(e)}
                        className="hover:bg-rose-50/40 cursor-pointer transition group"
                      >
                        <td className="p-3.5 pl-5 font-mono font-bold text-slate-900 group-hover:text-rose-600 transition flex items-center gap-1.5">
                          {e.shipmentId}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-rose-400" />
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${status.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          {e.motivo && (
                            <span className="block text-[10px] text-rose-600 font-mono mt-0.5 truncate max-w-[140px] font-medium">
                              {e.motivo}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-700 font-mono text-[11px]">
                          <span className="font-semibold">{e.zonaId ?? '-'}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-slate-500">{e.hubId ?? '-'}</span>
                        </td>
                        <td className="p-3.5 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              e.intentos >= 3
                                ? 'bg-rose-100 text-rose-800'
                                : e.intentos > 1
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {e.intentos ?? 1}/3
                          </span>
                        </td>
                        <td className="p-3.5">
                          {e.tieneAlerta ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              RIESGO
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">&mdash;</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right pr-5 text-slate-500 font-mono text-[11px]">
                          {e.actualizadoEn ? new Date(e.actualizadoEn).toLocaleTimeString() : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Prioritized SLA Risk Queue */}
        <div className="glass-card rounded-2xl border border-rose-100 flex flex-col overflow-hidden shadow-sm bg-white">
          <div className="p-4 sm:p-5 border-b border-rose-100 flex items-center justify-between bg-rose-50/70">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-bold text-sm text-rose-950">Cola de Alertas SLA</h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-mono font-bold">
              {data?.alertas?.length ?? 0}
            </span>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[540px] flex-1">
            {!data?.alertas || data.alertas.length === 0 ? (
              <div className="text-center p-12 text-slate-400 text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60" />
                <p className="font-medium text-slate-600">Sin alertas activas de SLA.</p>
                <p className="text-[11px] text-slate-400">Todos los envíos dentro del plazo.</p>
              </div>
            ) : (
              data.alertas.map((a) => (
                <div
                  key={a._id}
                  onClick={() => abrirDetalle({ shipmentId: a.shipmentId })}
                  className="p-3.5 bg-rose-50/30 border border-rose-200/80 hover:border-rose-300 rounded-xl cursor-pointer transition space-y-2 hover:bg-rose-50/60 group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-rose-600 transition flex items-center gap-1">
                      {a.shipmentId}
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-rose-500" />
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${badgePrioridad(a.prioridad)}`}>
                      {a.prioridad}
                    </span>
                  </div>
                  <div className="text-xs text-rose-900 font-medium leading-snug">
                    {a.causa}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-rose-100">
                    <span className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      {a.hubId ?? 'Hub'}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3 text-rose-400" />
                      {new Date(a.creadaEn).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Modal: Shipment Detail */}
      {envioSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-rose-100 pb-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-rose-500 font-semibold">
                  Supervisor &bull; Ficha Operativa
                </span>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black font-mono text-slate-900">
                    {envioSeleccionado.shipmentId}
                  </h3>
                  {(() => {
                    const st = badgeEstado(envioSeleccionado.estado);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-xs font-semibold ${st.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => {
                  setEnvioSeleccionado(null);
                  setDetalleEnvio(null);
                }}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cargandoDetalle ? (
              <div className="p-16 text-center text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
                Cargando historial del paquete...
              </div>
            ) : (
              <>
                {/* Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-rose-50/40 p-4 rounded-2xl border border-rose-100 text-xs">
                  <div>
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-400" /> Hub / Zona
                    </span>
                    <p className="font-bold text-slate-900 mt-0.5 font-mono">
                      {envioSeleccionado.hubId ?? '-'} / {envioSeleccionado.zonaId ?? '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3 text-rose-400" /> Repartidor
                    </span>
                    <p className="font-bold text-slate-900 mt-0.5 font-mono">
                      {envioSeleccionado.repartidorId ?? 'Sin asignar'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-rose-400" /> Intentos
                    </span>
                    <p className="font-bold text-slate-900 mt-0.5 font-mono">
                      {envioSeleccionado.intentos ?? 1} de 3
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-rose-400" /> Límite SLA
                    </span>
                    <p className="font-bold text-slate-900 mt-0.5 font-mono">
                      {envioSeleccionado.promesa?.venceEn
                        ? new Date(envioSeleccionado.promesa.venceEn).toLocaleTimeString()
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Rescheduling Decision Card (CU2) */}
                {envioSeleccionado.reprogramacion && (
                  <div className="p-4 bg-pink-50/70 border border-pink-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-pink-900 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 text-pink-600" />
                        Decisión de Reprogramación (CU2)
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-800 font-mono font-bold border border-pink-200">
                        {envioSeleccionado.reprogramacion.accion}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      Motivo de fallo: <span className="font-bold text-rose-600">{envioSeleccionado.reprogramacion.motivo}</span>
                    </p>
                    {envioSeleccionado.reprogramacion.proximoIntento && (
                      <p className="text-xs text-slate-700 font-mono">
                        Próximo intento programado:{' '}
                        <span className="text-rose-600 font-bold">
                          {new Date(envioSeleccionado.reprogramacion.proximoIntento).toLocaleDateString()} (Franja: {envioSeleccionado.reprogramacion.franja})
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {/* Notifications sent (CU2) */}
                {detalleEnvio?.notificaciones && detalleEnvio.notificaciones.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Avisos al Destinatario ({detalleEnvio.notificaciones.length})
                    </h4>
                    <div className="space-y-2">
                      {detalleEnvio.notificaciones.map((n, i) => (
                        <div key={i} className="p-3.5 bg-rose-50/30 border border-rose-100 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                            <span className="text-rose-700 font-bold">{n.canal} &rarr; {n.destinatario}</span>
                            <span>{new Date(n.ocurridoEn).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-800 text-xs">{n.mensaje}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedded Event Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Línea de Tiempo del Event Log
                  </h4>
                  <div className="space-y-3 border-l-2 border-rose-200 pl-4 ml-2">
                    {(detalleEnvio?.historial ?? envioSeleccionado.historial ?? []).map((h, i) => (
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
              </>
            )}

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-rose-100">
              <span className="text-[11px] text-slate-400 font-mono">Idempotencia verificada</span>
              <Link
                href={`/tracking?id=${envioSeleccionado.shipmentId}`}
                target="_blank"
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 transition"
              >
                Abrir en Tracking Público
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
