import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Instalar App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Share className="h-3.5 w-3.5" aria-hidden="true" />
          Instalar en iOS
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <h3
                  id="ios-install-title"
                  className="text-base font-semibold text-slate-100"
                >
                  Instalar en iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar guía de instalación"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-slate-300 list-decimal list-inside">
                <li>Tocá el botón Compartir en la barra de Safari.</li>
                <li>Deslizá hacia abajo y elegí Agregar a inicio.</li>
                <li>Confirmá para abrir ArgenCaja sin barra de navegador.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
