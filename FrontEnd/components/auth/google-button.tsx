import { signInWithGoogle } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/button";

export function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton variant="secondary" className="w-full" pendingText="Abriendo Google…">
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continuar con Google
      </SubmitButton>
    </form>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide opacity-50">
      <span className="h-px flex-1 bg-current opacity-30" />o<span className="h-px flex-1 bg-current opacity-30" />
    </div>
  );
}
