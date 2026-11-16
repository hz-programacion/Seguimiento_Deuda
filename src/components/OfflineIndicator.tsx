import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-slate-900 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Modo sin conexión — Datos guardados localmente</span>
    </div>
  );
};
