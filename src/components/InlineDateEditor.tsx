import React, { useEffect, useId, useRef, useState } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { formatDateAR } from '../utils/dateUtils';

interface InlineDateEditorProps {
  itemTitle: string;
  label: string; // e.g. "Vence" or "Cierre"
  dateISO?: string;
  placeholder?: string;
  textClassName?: string;
  readOnly?: boolean;
  onSaveDate: (newDateISO: string) => void;
}

export const InlineDateEditor: React.FC<InlineDateEditorProps> = ({
  itemTitle,
  label,
  dateISO,
  placeholder = 'Sin definir',
  textClassName = 'text-slate-300',
  readOnly = false,
  onSaveDate,
}) => {
  const inputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(dateISO ?? '');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(dateISO ?? '');
  }, [dateISO]);

  useEffect(() => {
    if (isEditing && !readOnly) {
      inputRef.current?.focus();
    }
  }, [isEditing, readOnly]);

  if (readOnly) {
    const roText = dateISO ? formatDateAR(dateISO) : placeholder;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono-tabular whitespace-nowrap ${textClassName}`}>
        <span className="text-slate-400">{label}:</span>
        <span className={dateISO ? 'text-slate-200' : 'text-slate-500'}>
          {roText}
        </span>
      </span>
    );
  }

  const commit = () => {
    if (!draft || !/^\d{4}-\d{2}-\d{2}$/.test(draft)) {
      setError(true);
      return;
    }
    setError(false);
    setIsEditing(false);
    if (draft !== dateISO) {
      onSaveDate(draft);
    }
  };

  const cancel = () => {
    setDraft(dateISO ?? '');
    setError(false);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1">
        <label htmlFor={inputId} className="sr-only">
          {`Nueva fecha de ${label.toLowerCase()} para ${itemTitle}`}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="date"
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
          className={`rounded-md border bg-slate-950 px-2 py-1 text-xs text-slate-100 font-mono-tabular focus-visible:outline-none focus-visible:ring-2 ${
            error
              ? 'border-rose-500 focus-visible:ring-rose-400'
              : 'border-emerald-500/60 focus-visible:ring-emerald-400'
          }`}
        />
        <button
          type="button"
          onClick={commit}
          aria-label={`Guardar fecha de ${label.toLowerCase()} de ${itemTitle}`}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/20 p-1 text-emerald-300 hover:bg-emerald-500/30"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label={`Cancelar edición de fecha de ${itemTitle}`}
          className="rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:bg-slate-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const displayText = dateISO ? formatDateAR(dateISO) : placeholder;

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title={`Clic para cambiar ${label.toLowerCase()} en este mes`}
      aria-label={`Editar ${label.toLowerCase()} de ${itemTitle}: ${displayText}`}
      className={`group inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-slate-800/80 font-mono-tabular whitespace-nowrap ${textClassName}`}
    >
      <span className="text-slate-400">{label}:</span>
      <span className={dateISO ? 'text-slate-200 group-hover:text-emerald-300' : 'text-slate-500 group-hover:text-emerald-300'}>
        {displayText}
      </span>
      <Calendar
        className="h-3 w-3 text-slate-500 opacity-70 transition-opacity group-hover:opacity-100 group-hover:text-emerald-400"
        aria-hidden="true"
      />
    </button>
  );
};
