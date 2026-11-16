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
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE] whitespace-nowrap shrink-0"
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap shrink-0"
        >
          <Share className="h-3.5 w-3.5" aria-hidden="true" />
          Instalar en iOS
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#111318]/45 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <h3
                  id="ios-install-title"
                  className="font-display text-base font-bold text-[#111318]"
                >
                  Instalar en iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar guía de instalación"
                  className="rounded-lg p-1 text-[#747A88] hover:bg-[#F6F6F3] hover:text-[#111318]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-[#525866]">
                <li>Tocá el botón Compartir en la barra de Safari.</li>
                <li>Deslizá hacia abajo y elegí Agregar a inicio.</li>
                <li>Confirmá para abrir ArgenCaja sin barra de navegador.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#1D4ED8] py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
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
