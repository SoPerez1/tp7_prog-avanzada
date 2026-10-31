'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, 
  Search, 
  BarChart3, 
  PlayCircle, 
  Package
} from 'lucide-react';

export default function RootLayout({ children }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Torre de Control', icon: Activity },
    { href: '/tracking', label: 'Tracking Público', icon: Search },
    { href: '/analitica', label: 'Analítica', icon: BarChart3 },
    { href: '/demo', label: 'Panel de Demo', icon: PlayCircle, highlight: true },
  ];

  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col antialiased selection:bg-rose-200 selection:text-rose-900">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-50 border-b border-rose-100 bg-white/80 backdrop-blur-md shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/25 group-hover:scale-105 transition">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                    RutaSur
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-wider">
                      EDA
                    </span>
                  </span>
                  <span className="text-[11px] text-rose-400 block -mt-0.5 font-medium">
                    Logística en Tiempo Real
                  </span>
                </div>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-rose-50 text-rose-600 font-semibold shadow-xs border border-rose-200'
                          : item.highlight
                          ? 'text-pink-600 hover:bg-pink-50 hover:text-pink-700'
                          : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50/60'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-rose-500' : ''}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-rose-200 text-[11px] font-mono text-slate-600 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span className="hidden sm:inline text-slate-400">Stream:</span>
                <span className="text-rose-600 font-semibold">Kafka + SSE</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-rose-100 bg-white/70 py-5 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>RutaSur &mdash; Licenciatura en Sistemas de Información (Programación Avanzada 2026)</span>
            <div className="flex items-center gap-4 text-[11px] font-mono text-rose-400">
              <span>Kafka KRaft</span>
              <span>&bull;</span>
              <span>Node.js</span>
              <span>&bull;</span>
              <span>MongoDB Change Streams</span>
              <span>&bull;</span>
              <span>Next.js</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
