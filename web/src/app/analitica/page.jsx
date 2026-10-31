'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Layers,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  MapPin,
  Building2
} from 'lucide-react';

export default function Analitica() {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [zonaFiltro, setZonaFiltro] = useState('');
  const [hubFiltro, setHubFiltro] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cargarAnalitica = async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (zonaFiltro) params.append('zonaId', zonaFiltro);
      if (hubFiltro) params.append('hubId', hubFiltro);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    cargarAnalitica();
  }, [zonaFiltro, hubFiltro]);

  const r = data?.resumen;
  const totalMotivos = Object.values(r?.motivosGlobal ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Executive Header & Filter Controls */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm bg-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Panel Analítico de Operaciones
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Métricas de mejora continua precalculadas con incrementos atómicos ($inc) en MongoDB (CU4)
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={hubFiltro}
              onChange={(e) => setHubFiltro(e.target.value)}
              className="bg-white border border-rose-200 text-xs text-slate-800 rounded-xl px-3.5 py-2 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 transition appearance-none pr-8 font-mono shadow-2xs font-medium"
            >
              <option value="">Todos los Hubs</option>
              <option value="HUB-1">Hub Central (HUB-1)</option>
              <option value="HUB-2">Hub Norte (HUB-2)</option>
              <option value="HUB-3">Hub Sur (HUB-3)</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={zonaFiltro}
              onChange={(e) => setZonaFiltro(e.target.value)}
              className="bg-white border border-rose-200 text-xs text-slate-800 rounded-xl px-3.5 py-2 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 transition appearance-none pr-8 font-mono shadow-2xs font-medium"
            >
              <option value="">Todas las Zonas</option>
              <option value="Z-1">Zona 1</option>
              <option value="Z-2">Zona 2</option>
              <option value="Z-3">Zona 3</option>
              <option value="Z-4">Zona 4</option>
              <option value="Z-5">Zona 5</option>
            </select>
          </div>

          <button
            onClick={cargarAnalitica}
            disabled={isRefreshing}
            className="p-2 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl text-slate-600 hover:text-rose-600 transition shadow-2xs"
            title="Refrescar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="p-24 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
          Calculando agregaciones analíticas...
        </div>
      ) : (
        <>
          {/* Top 3 Core Business Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Indicador 1 */}
            <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-5 shadow-sm bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-500">
                    Indicador 1 &bull; Calidad
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold font-mono">
                    {r?.tasaPrimerIntento ?? 100}%
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  Tasa de Entrega en 1er Intento
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ¿Dónde y cuándo fallamos más?
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-rose-100/70 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${r?.tasaPrimerIntento ?? 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono pt-1 text-slate-500">
                  <span>Éxitos: <strong className="text-slate-900">{r?.totalEntregas1er ?? 0}</strong></span>
                  <span>Fallos: <strong className="text-rose-600">{r?.totalFallos1er ?? 0}</strong></span>
                </div>
              </div>
            </div>

            {/* Indicador 2 */}
            <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-4 shadow-sm bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-500">
                    Indicador 2 &bull; Diagnóstico
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono font-semibold">
                    {totalMotivos} fallos
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  Distribución de Motivos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ¿Por qué se frustra la entrega?
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                {Object.entries(r?.motivosGlobal ?? {}).map(([motivo, cant]) => {
                  const pct = totalMotivos > 0 ? Math.round((cant / totalMotivos) * 100) : 0;
                  return (
                    <div key={motivo} className="space-y-1">
                      <div className="flex justify-between text-slate-600 font-mono text-[11px]">
                        <span>{motivo}</span>
                        <span className="text-slate-900 font-bold">{cant} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-rose-100/70 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-pink-500 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Indicador 3 */}
            <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-5 shadow-sm bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-500">
                    Indicador 3 &bull; Compromiso
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold font-mono">
                    {r?.tasaCumplimientoSLA ?? 100}%
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  Cumplimiento de SLA
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ¿Qué hub cumple los plazos prometidos?
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-rose-100/70 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${r?.tasaCumplimientoSLA ?? 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono pt-1 text-slate-500">
                  <span>A tiempo: <strong className="text-slate-900">{r?.slaCumplidos ?? 0}</strong></span>
                  <span>Con demora: <strong className="text-rose-600">{r?.slaIncumplidos ?? 0}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Indicador 4: Replay de Tiempos en Hub */}
          <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-5 shadow-sm bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-rose-600">
                    Indicador 4 &bull; Demostración de Replay Histórico (CU4)
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Tiempo Medio entre Ingreso a Hub y Despacho a Reparto
                </h3>
                <p className="text-xs text-slate-500">
                  Calculado con un nuevo grupo de consumidores que reprocesa el log desde offset 0 sin tocar los servicios activos.
                </p>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-mono text-rose-700">
                CLI: <strong className="text-rose-800">pnpm replay:indicador4</strong>
              </div>
            </div>

            {!data?.hubTiempos || data.hubTiempos.length === 0 ? (
              <div className="text-center p-12 text-slate-400 text-xs space-y-2">
                <Clock className="w-8 h-8 mx-auto text-rose-300" />
                <p className="font-medium text-slate-600">El 4º indicador aún no fue materializado por replay.</p>
                <p className="text-slate-500">
                  Ejecutá en terminal:{' '}
                  <code className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    pnpm replay:indicador4
                  </code>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.hubTiempos.map((h) => (
                  <div
                    key={h.hubId}
                    className="p-5 bg-rose-50/40 rounded-2xl border border-rose-100 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-rose-500" />
                        {h.hubId}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{h.totalEnvios} paquetes</span>
                    </div>
                    <div className="text-3xl font-black font-mono text-rose-600">
                      {h.promedioHoras} <span className="text-sm font-normal text-slate-500">horas</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono text-slate-600 border-t border-rose-100 pt-2">
                      <span>Mín: {h.minHoras}h</span>
                      <span>Máx: {h.maxHoras}h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Zone Performance Table */}
          <div className="glass-card rounded-3xl border border-rose-100 overflow-hidden shadow-sm bg-white">
            <div className="p-5 border-b border-rose-100 flex items-center justify-between bg-rose-50/40">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                Rendimiento Operativo por Zona Geográfica
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {data?.porZona?.length ?? 0} zonas monitoreadas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-50/60 text-slate-700 border-b border-rose-100 font-mono text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-5">Zona</th>
                    <th className="p-3.5">Hub Asignado</th>
                    <th className="p-3.5">Éxito 1er Intento</th>
                    <th className="p-3.5">Fallo 1er Intento</th>
                    <th className="p-3.5">Total Fallos</th>
                    <th className="p-3.5 pr-5 text-right">Efectividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100/60 font-mono">
                  {data?.porZona?.map((z) => {
                    const total1 = z.entregados1er + z.fallos1er;
                    const tasa = total1 > 0 ? Math.round((z.entregados1er / total1) * 100) : 100;
                    return (
                      <tr key={z.zonaId} className="hover:bg-rose-50/40 transition">
                        <td className="p-3.5 pl-5 font-bold text-slate-900">{z.zonaId}</td>
                        <td className="p-3.5 text-slate-600">{z.hubId}</td>
                        <td className="p-3.5 text-emerald-700 font-semibold">{z.entregados1er}</td>
                        <td className="p-3.5 text-rose-700 font-semibold">{z.fallos1er}</td>
                        <td className="p-3.5 text-slate-600">{z.totalFallos}</td>
                        <td className="p-3.5 pr-5 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              tasa >= 80
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {tasa}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
