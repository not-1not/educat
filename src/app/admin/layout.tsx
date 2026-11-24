import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-bold">Konfigurasi belum lengkap</h1>
        <p className="mt-2 text-sm text-slate-600">
          Buat berkas <code>.env.local</code> berisi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, lalu jalankan ulang <code>npm run dev</code>.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk");

  const { data: op } = await supabase
    .from("operators")
    .select("school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!op) redirect("/mulai");

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", op.school_id)
    .single();

  return (
    <AppShell schoolName={school?.name ?? "Sekolah"} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
