import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Halaman siswa (/ujian) sengaja tidak melewati proxy: siswa tidak punya akun.
export const config = {
  matcher: ["/admin/:path*", "/mulai", "/masuk"],
};
