import { AppNav } from "@/components/app-nav";
import { requireCompleteProfile } from "@/lib/auth";

/** Zona logueada: exige sesión, cuenta activa y perfil completo. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireCompleteProfile();
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-6 pb-24">{children}</main>
      <AppNav isSystemAdmin={profile.isSystemAdmin} />
    </>
  );
}
