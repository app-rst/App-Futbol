import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string[] | string;
  hint?: ReactNode;
};

export function Field({ label, name, error, hint, id, className, ...props }: FieldProps) {
  const inputId = id ?? name;
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className="h-12 w-full rounded-xl border border-black/15 bg-white px-3 text-base outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-700/20 aria-[invalid]:border-red-600 dark:border-white/15 dark:bg-white/5"
        {...props}
      />
      {message ? (
        <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs opacity-60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
