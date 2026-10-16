import type { ReactNode } from "react";

const styles = {
  error: "border-red-600/30 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  success: "border-green-700/30 bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200",
  info: "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/5",
};

export function Alert({ kind = "info", children }: { kind?: keyof typeof styles; children: ReactNode }) {
  if (!children) return null;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${styles[kind]}`}>
      {children}
    </div>
  );
}
