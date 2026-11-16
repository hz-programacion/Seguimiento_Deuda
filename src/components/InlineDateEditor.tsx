import React, { useEffect, useId, useRef, useState } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { formatDateAR } from '../utils/dateUtils';

interface InlineDateEditorProps {
  itemTitle: string;
  label: string;
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
  textClassName = 'text-[#525866]',
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
      <span
        className={`inline-flex items-center gap-1 font-mono-tabular text-xs whitespace-nowrap ${textClassName}`}
      >
        <span className="text-[#747A88]">{label}:</span>
        <span className={dateISO ? 'font-medium text-[#111318]' : 'text-[#747A88]'}>
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
      <div className="inline-flex items-center gap-1.5">
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
          className={`min-h-[34px] rounded-lg border bg-white px-2 py-1 font-mono-tabular text-xs text-[#111318] focus-visible:outline-none focus-visible:ring-2 ${
            error
              ? 'border-[#DC2626] focus-visible:ring-[#DC2626]'
              : 'border-[#1D4ED8] focus-visible:ring-[#1D4ED8]'
          }`}
        />
        <button
          type="button"
          onClick={commit}
          aria-label={`Guardar fecha de ${label.toLowerCase()} de ${itemTitle}`}
          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg bg-[#1D4ED8] p-1.5 text-white hover:bg-[#1E40AF]"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label={`Cancelar edición de fecha de ${itemTitle}`}
          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] p-1.5 text-[#525866] hover:bg-[#EEEDE8] hover:text-[#111318]"
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
      className={`group inline-flex min-h-[28px] items-center gap-1 rounded-md px-1.5 py-0.5 font-mono-tabular text-xs transition-colors hover:bg-[#EFF6FF] whitespace-nowrap ${textClassName}`}
    >
      <span className="text-[#747A88]">{label}:</span>
      <span
        className={
          dateISO
            ? 'font-medium text-[#111318] group-hover:text-[#1D4ED8]'
            : 'text-[#747A88] group-hover:text-[#1D4ED8]'
        }
      >
        {displayText}
      </span>
      <Calendar
        className="h-3 w-3 text-[#747A88] opacity-70 transition-opacity group-hover:text-[#1D4ED8] group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
};
