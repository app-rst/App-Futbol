import { signOut } from "@/app/actions/auth";
import { ProfileForm } from "@/components/profile-form";
import { SubmitButton } from "@/components/ui/button";
import { getMyProfile } from "@/lib/auth";
import { formatArPhone } from "@/lib/phone";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const profile = (await getMyProfile())!;
  return (
    <>
      <header>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm opacity-60">{profile.email}</p>
      </header>
      <ProfileForm
        initial={{
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          nickname: profile.nickname ?? "",
          phone: profile.phone ? formatArPhone(profile.phone) : "",
        }}
      />
      <form action={signOut} className="border-t border-black/10 pt-5 dark:border-white/10">
        <SubmitButton variant="secondary" className="w-full" pendingText="Saliendo…">
          Cerrar sesión
        </SubmitButton>
      </form>
    </>
  );
}
