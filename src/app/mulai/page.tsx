import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Siapkan sekolah" };
export const dynamic = "force-dynamic";

export default async function MulaiPage() {
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
  if (op) redirect("/admin");

  const meta = (user.user_metadata ?? {}) as { school_name?: string; npsn?: string };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <SetupForm defaultName={meta.school_name ?? ""} defaultNpsn={meta.npsn ?? ""} />
    </main>
  );
}
