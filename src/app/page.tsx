import Link from "next/link";

export default function Home() {
  return (
    <main className="auth-stage flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1fr_0.9fr] md:gap-16">
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-700 to-orange-300 text-xl font-bold text-white shadow-lg shadow-brand-700/20">
              E
            </div>
            <span className="text-lg font-bold tracking-tight">EduCAT</span>
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
            Ujian lebih teratur
          </p>
          <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Semua kebutuhan ujian, dalam satu tempat.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Platform ujian berbasis komputer yang membantu sekolah menyiapkan,
            mengelola, dan memantau ujian dengan lebih mudah.
          </p>
        </section>

        <section className="glass-panel rounded-3xl border p-5 shadow-xl shadow-slate-900/5 sm:p-7">
          <h2 className="text-xl font-bold text-slate-900">Lanjutkan sebagai</h2>
          <p className="mt-1 text-sm text-slate-600">Pilih akses sesuai peran Anda.</p>
          <div className="mt-6 grid gap-3">
            <Link
              href="/ujian"
              className="touch-target flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 px-4 py-4 font-semibold text-white shadow-md shadow-brand-700/15 transition hover:-translate-y-0.5 hover:from-brand-900 hover:to-brand-700"
            >
              <span>
                <span className="block">Saya siswa</span>
                <span className="mt-0.5 block text-sm font-normal text-white/80">Masuk dan mulai ujian</span>
              </span>
              <span aria-hidden="true" className="text-xl">→</span>
            </Link>
            <Link
              href="/admin"
              className="touch-target flex items-center justify-between rounded-2xl border border-white/80 bg-white/65 px-4 py-4 font-semibold text-slate-800 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white"
            >
              <span>
                <span className="block">Saya operator sekolah</span>
                <span className="mt-0.5 block text-sm font-normal text-slate-500">Kelola ujian dan data siswa</span>
              </span>
              <span aria-hidden="true" className="text-xl text-brand-700">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
