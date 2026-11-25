import Link from "next/link";

export default function Home() {
  return (
    <main className="auth-stage flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        <div className="clay-card p-6 sm:p-8">
          <div className="mx-auto mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-700 to-orange-400 text-xl font-bold text-white shadow-lg shadow-brand-700/25">
              E
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              EduCAT
            </span>
          </div>

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 sm:text-sm">
            Ujian lebih teratur
          </p>
          <h1 className="max-w-xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Semua kebutuhan ujian, dalam satu tempat.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Platform ujian berbasis komputer yang membantu sekolah menyiapkan,
            mengelola, dan memantau ujian dengan lebih mudah.
          </p>

          <div className="mt-8 grid gap-3 sm:mt-10">
            <Link
              href="/ujian"
              className="btn-clay touch-target flex items-center justify-between rounded-2xl px-5 py-4 font-semibold text-white transition hover:-translate-y-0.5 sm:px-6 sm:py-5"
            >
              <span>
                <span className="block">Saya siswa</span>
                <span className="mt-0.5 block text-sm font-normal text-white/90">
                  Mulai ujian di sini
                </span>
              </span>
              <span aria-hidden="true" className="text-xl">→</span>
            </Link>
            <Link
              href="/admin"
              className="touch-target flex items-center justify-between rounded-2xl border border-white/70 bg-white/55 px-4 py-4 font-semibold text-slate-800 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/70 sm:px-6 sm:py-5"
            >
              <span>
                <span className="block">Saya operator sekolah</span>
                <span className="mt-0.5 block text-sm font-normal text-slate-500">
                  Kelola ujian dan data siswa
                </span>
              </span>
              <span aria-hidden="true" className="text-xl text-brand-600">→</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
