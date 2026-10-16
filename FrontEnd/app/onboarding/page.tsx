import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getMyProfile, requireUser } from "@/lib/auth";
import { formatArPhone, normalizeArPhone } from "@/lib/phone";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Completá tu perfil" };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser();
  const next = safeNext((await searchParams).next);
  const profile = await getMyProfile();
  if (profile?.isComplete) redirect(next);

  // Lo que falte en el perfil se precarga con lo que el usuario ya escribió al
  // registrarse (o lo que trae Google), para no pedirle dos veces lo mismo.
  const meta = user.metadata;
  const metaPhone = normalizeArPhone(str(meta.phone));
  const phone = profile?.phone ?? metaPhone;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-3xl" aria-hidden>
          👋
        </p>
        <h1 className="text-xl font-semibold">Completá tu perfil</h1>
        <p className="text-sm opacity-70">
          Necesitamos estos datos antes de que puedas sumarte a un partido. Los demás solo ven tu apodo (o tu nombre).
        </p>
      </div>
      <ProfileForm
        next={next}
        submitLabel="Continuar"
        initial={{
          first_name: profile?.first_name ?? (str(meta.first_name) || str(meta.given_name)),
          last_name: profile?.last_name ?? (str(meta.last_name) || str(meta.family_name)),
          nickname: profile?.nickname ?? str(meta.nickname),
          phone: phone ? formatArPhone(phone) : "",
        }}
      />
    </main>
  );
}
