import React, { useId } from 'react';
import type { IconType } from 'react-icons';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  icon?: IconType;
  error?: string;
}

export function Input({
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  required = false,
  className = '',
  icon: Icon,
  error,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`space-y-1.5 text-left w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
          {label}
        </label>
      )}
      <div className="relative w-full">
        {Icon && <Icon aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] text-sm" />}
        <input
          id={inputId}
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`w-full rounded-xl bg-[var(--bg-surface)] border ${
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : 'border-[var(--border)] focus:border-[var(--primary)]'
          } ${Icon ? 'pl-10' : 'px-4'} pr-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-[3px] focus:ring-[var(--primary)]/25 transition duration-200`}
          {...props}
        />
      </div>
      {error && <p id={errorId} role="alert" className="text-xs text-[var(--danger)] font-medium">{error}</p>}
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  className?: string;
  error?: string;
  rows?: number;
}

export function Textarea({
  label,
  placeholder = '',
  value,
  onChange,
  required = false,
  className = '',
  error,
  rows = 4,
  id,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className={`space-y-1.5 text-left w-full ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={`w-full rounded-xl bg-[var(--bg-surface)] border ${
          error
            ? 'border-[var(--danger)] focus:border-[var(--danger)]'
            : 'border-[var(--border)] focus:border-[var(--primary)]'
        } px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-[3px] focus:ring-[var(--primary)]/25 transition duration-200 resize-none font-mono`}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-[var(--danger)] font-medium">{error}</p>}
    </div>
  );
}
