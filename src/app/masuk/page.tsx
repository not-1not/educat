import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Masuk operator" };

export default function MasukPage() {
  return (
    <main className="auth-stage flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense>
        <AuthForm />
      </Suspense>
    </main>
  );
}
