'use client';

import { useState, useEffect } from 'react';
import {
  PlayCircle,
  Zap,
  CheckCircle2,
  Clock,
  RotateCcw,
  UserX,
  Layers,
  ArrowRight,
  ShieldCheck,
  Radio,
  FileText,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function PanelDemo() {
  const [simHealth, setSimHealth] = useState(null);
  const [ejecutando, setEjecutando] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [pasoActivo, setPasoActivo] = useState(1);

  const consultarSimulador = async () => {
    try {
      const res = await fetch('/api/scenarios');
      const data = await res.json();
      setSimHealth(data);
    } catch {
      setSimHealth({ status: 'offline' });
    }
  };

  useEffect(() => {
    consultarSimulador();
    const t = setInterval(consultarSimulador, 4000);
    return () => clearInterval(t);
  }, []);

  const dispararEscenario = async (nombre, descripcion) => {
    setEjecutando(nombre);
    setResultado(null);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escenario: nombre }),
      });
      const data = await res.json();
      setResultado({
        exito: res.ok,
        nombre,
        descripcion,
        mensaje: data.mensaje ?? `Escenario "${nombre}" enviado con éxito al broker Kafka.`,
      });
    } catch (e) {
      setResultado({
        exito: false,
        nombre,
        descripcion,
        mensaje: `Error comunicando con simulador: ${e.message}`,
      });
    } finally {
      setEjecutando(null);
      consultarSimulador();
    }
  };

  const escenarios = [
    {
      id: 'feliz',
      titulo: 'Envío Feliz',
      caso: 'CU1',
      icono: Sparkles,
      colorIcono: 'text-rose-600 bg-rose-50 border-rose-200',
      concepto: 'Productor, consumidor y proyección',
      descripcion: 'El paquete recorre Creado &rarr; Hub &rarr; Clasificado &rarr; Reparto &rarr; Entregado sin contratiempos.',
      hoverBorder: 'hover:border-rose-400 hover:shadow-md',
    },
    {
      id: 'ausente',
      titulo: 'Destinatario Ausente',
      caso: 'CU2',
      icono: UserX,
      colorIcono: 'text-pink-600 bg-pink-50 border-pink-200',
      concepto: '3 grupos de consumidores sobre 1 evento',
      descripcion: 'Falla por AUSENTE. Se dispara en paralelo Notificación al cliente, Reprogramación a la franja opuesta y Analítica.',
      hoverBorder: 'hover:border-pink-400 hover:shadow-md',
    },
    {
      id: 'demorado',
      titulo: 'Demorado en Hub',
      caso: 'CU3',
      icono: Clock,
      colorIcono: 'text-rose-600 bg-rose-50 border-rose-200',
      concepto: 'Procesamiento con estado y tiempo',
      descripcion: 'El paquete se detiene en hub. El reloj acelerado avanza sin salida y dispara la alerta de SLA con prioridad ALTA.',
      hoverBorder: 'hover:border-rose-400 hover:shadow-md',
    },
    {
      id: 'tercer-fallo',
      titulo: 'Tercer Fallo (Devolución)',
      caso: 'CU2',
      icono: RotateCcw,
      colorIcono: 'text-red-600 bg-red-50 border-red-200',
      concepto: 'Límite de intentos y cambio de flujo',
      descripcion: 'Agota 3 intentos fallidos consecutivos: Reprogramación lo deriva formalmente a devolución al comercio remitente.',
      hoverBorder: 'hover:border-red-400 hover:shadow-md',
    },
    {
      id: 'rafaga',
      titulo: 'Ráfaga de 500 Envíos',
      caso: 'Estrés',
      icono: Zap,
      colorIcono: 'text-purple-600 bg-purple-50 border-purple-200',
      concepto: 'Particionamiento, lag y drenaje',
      descripcion: 'Inyecta 500 envíos en pocos segundos para observar el incremento y la recuperación del lag por partición.',
      hoverBorder: 'hover:border-purple-400 hover:shadow-md',
    },
  ];

  const pasosDemo = [
    { n: 1, tit: 'Arranque del Entorno', desc: 'Levantar el stack y observar contadores en vivo en la Torre de Control.' },
    { n: 2, tit: 'Envío Feliz (CU1)', desc: 'Seguir un envío en el Tracking Público hasta ENTREGADO sin incidentes.' },
    { n: 3, tit: 'Ausente (CU2)', desc: 'Constatar las 3 reacciones independientes: aviso, reprogramación y analítica.' },
    { n: 4, tit: 'Demorado en Hub (CU3)', desc: 'Observar cómo el tiempo simulado genera la alerta en cola priorizada.' },
    { n: 5, tit: 'Aislamiento de Servicio', desc: 'Detener notificaciones (`pnpm lag`), verificar lag creciente y recuperación sin duplicados.' },
    { n: 6, tit: 'Evento Inválido (DLQ)', desc: 'El simulador desvía un JSON malformado a DLQ sin frenar los demás eventos.' },
    { n: 7, tit: 'Panel Analítico (CU4)', desc: 'Identificar la zona con más ausencias y justificar la mejora operativa.' },
    { n: 8, tit: 'Replay Histórico', desc: 'Ejecutar `pnpm replay:indicador4` y completar el tiempo medio en hub retrospectivamente.' },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Simulator Health Status */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm bg-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <PlayCircle className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Panel de Control de la Demostración
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Disparadores de eventos para ensayar la defensa de 15 minutos paso a paso
          </p>
        </div>

        {/* Live Simulator Telemetry */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-rose-50/60 border border-rose-200 text-xs font-mono flex items-center gap-2.5 shadow-2xs">
            <span className="text-slate-500">Simulador:</span>
            {simHealth?.status === 'ok' || simHealth?.simNow ? (
              <span className="text-rose-600 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                ONLINE (:4000)
              </span>
            ) : (
              <span className="text-slate-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                OFFLINE
              </span>
            )}
          </div>
          {simHealth?.simNow && (
            <div className="hidden md:flex px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-xs font-mono text-slate-600 shadow-2xs">
              <span className="text-slate-400 mr-1.5">Reloj Sim:</span>
              <strong className="text-slate-800">{new Date(simHealth.simNow).toLocaleTimeString()}</strong>
            </div>
          )}
        </div>
      </div>

      {resultado && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between shadow-2xs ${
            resultado.exito
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div>
            <strong>Escenario {resultado.nombre}:</strong> {resultado.mensaje}
          </div>
          <button
            onClick={() => setResultado(null)}
            className="text-xs text-rose-400 hover:text-rose-700 px-2 py-1 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scenario Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {escenarios.map((esc) => {
          const Icon = esc.icono;
          const isCurrent = ejecutando === esc.id;
          return (
            <div
              key={esc.id}
              className={`glass-card rounded-3xl p-6 border border-rose-100 flex flex-col justify-between space-y-4 shadow-sm bg-white transition-all ${esc.hoverBorder}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${esc.colorIcono}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                    {esc.caso}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{esc.titulo}</h3>
                  <span className="text-xs text-rose-600 font-semibold block mt-0.5">
                    {esc.concepto}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {esc.descripcion}
                </p>
              </div>

              <button
                onClick={() => dispararEscenario(esc.id, esc.descripcion)}
                disabled={ejecutando !== null}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700 rounded-xl font-bold text-xs font-mono transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xs group"
              >
                {isCurrent ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                    Publicando en Kafka...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3.5 h-3.5 text-rose-500 group-hover:text-white transition" />
                    Ejecutar Escenario
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Interactive Presentation Guide (15 Minutos) */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-rose-100 space-y-5 shadow-sm bg-white">
        <div className="flex items-center justify-between border-b border-rose-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Guion de la Presentación y Evaluación (15 Minutos)
            </h3>
          </div>
          <span className="text-xs font-mono text-rose-600 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            8 Etapas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {pasosDemo.map((p) => {
            const isSelected = pasoActivo === p.n;
            return (
              <div
                key={p.n}
                onClick={() => setPasoActivo(p.n)}
                className={`p-4 rounded-2xl border cursor-pointer transition text-xs space-y-1.5 shadow-2xs ${
                  isSelected
                    ? 'bg-rose-50/90 border-rose-400 text-rose-950 shadow-sm ring-2 ring-rose-200'
                    : 'bg-white border-rose-100 hover:bg-rose-50/40 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className={`font-bold ${isSelected ? 'text-rose-600' : 'text-slate-500'}`}>
                    Paso {p.n}
                  </span>
                  {isSelected && <span className="text-[10px] text-rose-600 font-sans font-bold">Activo</span>}
                </div>
                <div className="font-bold text-slate-900">{p.tit}</div>
                <p className="text-[11px] text-slate-500 leading-snug">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
