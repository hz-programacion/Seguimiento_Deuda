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
  textClassName = 'text-[#111318]',
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
      <div className="inline-flex items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Nuevo monto para {itemTitle}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="number"
          inputMode="decimal"
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
          className={`w-28 min-h-[34px] rounded-lg border bg-white px-2.5 py-1 text-right font-mono-tabular text-xs text-[#111318] focus-visible:outline-none focus-visible:ring-2 ${
            error
              ? 'border-[#DC2626] focus-visible:ring-[#DC2626]'
              : 'border-[#1D4ED8] focus-visible:ring-[#1D4ED8]'
          }`}
        />
        <button
          type="button"
          onClick={commit}
          aria-label={`Guardar monto de ${itemTitle}`}
          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg bg-[#1D4ED8] p-1.5 text-white hover:bg-[#1E40AF]"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label={`Cancelar edición de ${itemTitle}`}
          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] p-1.5 text-[#525866] hover:bg-[#EEEDE8] hover:text-[#111318]"
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
      className={`group inline-flex min-h-[30px] items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono-tabular transition-colors hover:bg-[#EFF6FF] ${textClassName}`}
    >
      <span>
        {prefix}
        {MoneyUtils.formatARS(amount)}
      </span>
      <Pencil
        className="h-3 w-3 text-[#747A88] opacity-60 transition-opacity group-hover:text-[#1D4ED8] group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
};
