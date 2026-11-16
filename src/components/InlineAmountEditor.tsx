import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { MoneyUtils } from '../utils/moneyUtils';

interface InlineAmountEditorProps {
  itemTitle: string;
  amount: number;
  prefix?: string;
  textClassName?: string;
  readOnly?: boolean;
  onSaveAmount: (newAmount: number) => void;
}

export const InlineAmountEditor: React.FC<InlineAmountEditorProps> = ({
  itemTitle,
  amount,
  prefix = '',
  textClassName = 'text-slate-100',
  readOnly = false,
  onSaveAmount,
}) => {
  const inputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(amount));
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(amount));
  }, [amount]);

  useEffect(() => {
    if (isEditing && !readOnly) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, readOnly]);

  if (readOnly) {
    return (
      <span className={`font-mono-tabular ${textClassName}`}>
        {prefix}
        {MoneyUtils.formatARS(amount)}
      </span>
    );
  }

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(true);
      return;
    }
    setError(false);
    setIsEditing(false);
    const normalized = MoneyUtils.fromCents(MoneyUtils.toCents(parsed));
    if (MoneyUtils.toCents(normalized) !== MoneyUtils.toCents(amount)) {
      onSaveAmount(normalized);
    }
  };

  const cancel = () => {
    setDraft(String(amount));
    setError(false);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1">
        <label htmlFor={inputId} className="sr-only">
          Nuevo monto para {itemTitle}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className={`w-28 rounded-md border bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 font-mono-tabular focus-visible:outline-none focus-visible:ring-2 ${
            error
              ? 'border-rose-500 focus-visible:ring-rose-400'
              : 'border-emerald-500/60 focus-visible:ring-emerald-400'
          }`}
        />
        <button
          type="button"
          onClick={commit}
          aria-label={`Guardar monto de ${itemTitle}`}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/20 p-1 text-emerald-300 hover:bg-emerald-500/30"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label={`Cancelar edición de ${itemTitle}`}
          className="rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:bg-slate-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title="Clic para modificar este monto en el mes activo"
      aria-label={`Editar monto de ${itemTitle}: ${prefix}${MoneyUtils.formatARS(amount)}`}
      className={`group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-slate-800/80 font-mono-tabular ${textClassName}`}
    >
      <span>
        {prefix}
        {MoneyUtils.formatARS(amount)}
      </span>
      <Pencil
        className="h-3 w-3 text-slate-500 opacity-60 transition-opacity group-hover:opacity-100 group-hover:text-emerald-400"
        aria-hidden="true"
      />
    </button>
  );
};
