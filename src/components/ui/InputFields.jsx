import React from 'react';

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
  ...props
}) {
  return (
    <div className={`space-y-1.5 text-left w-full ${className}`}>
      {label && <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">{label}</label>}
      <div className="relative w-full">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />}
        <input
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full rounded-xl bg-background border ${
            error ? 'border-red-500/50' : 'border-white/10 focus:border-primary/50'
          } ${Icon ? 'pl-10' : 'px-4'} pr-4 py-3 text-sm text-white focus:outline-none transition duration-200`}
          {...props}
        />
      </div>
      {error && <p className="text-[10px] text-red-400 font-medium">{error}</p>}
    </div>
  );
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
  ...props
}) {
  return (
    <div className={`space-y-1.5 text-left w-full ${className}`}>
      {label && <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">{label}</label>}
      <textarea
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-xl bg-background border ${
          error ? 'border-red-500/50' : 'border-white/10 focus:border-primary/50'
        } px-4 py-3 text-sm text-white focus:outline-none transition duration-200 resize-none font-mono`}
        {...props}
      />
      {error && <p className="text-[10px] text-red-400 font-medium">{error}</p>}
    </div>
  );
}
