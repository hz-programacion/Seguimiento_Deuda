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
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2 text-xs font-semibold text-[#92400E] shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-[#D97706]" aria-hidden="true" />
      <span>Modo sin conexión — Datos guardados localmente</span>
    </div>
  );
};
