"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./button-styles";

type SubmitProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pendingText?: string;
};

/** Botón de submit que se deshabilita mientras la Server Action está corriendo. */
export function SubmitButton({ children, variant = "primary", pendingText, className, disabled, ...props }: SubmitProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={buttonClass(variant, className)}
      {...props}
    >
      {pending ? (pendingText ?? "Un momento…") : children}
    </button>
  );
}
