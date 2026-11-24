"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import type { ExamResult } from "@/lib/types";
import { errMsg } from "@/lib/util";
import {
  clearCred,
  examGet,
  examResult,
  examStart,
  loadCred,
  saveCred,
  type Cred,
  type ExamData,
} from "./api";
import { ExamView } from "./ExamView";
import { LoginForm } from "./LoginForm";
import { ResultView } from "./ResultView";

type Phase =
  | { name: "loading" }
  | { name: "login"; notice?: string }
  | { name: "exam"; cred: Cred; data: ExamData; offset: number; fresh: boolean }
  | { name: "result"; cred: Cred; result: ExamResult; student: string; subject: string };

const offsetOf = (serverNow: string) => new Date(serverNow).getTime() - Date.now();

export function ExamApp() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });

  // Buka sesi yang sudah ada (mis. setelah refresh) atau tampilkan form masuk.
  const enter = useCallback(async (cred: Cred, fresh: boolean) => {
    const data = await examGet(cred);
    if (data.status === "active") {
      setPhase({ name: "exam", cred, data, offset: offsetOf(data.server_now), fresh });
    } else {
      const result = await examResult(cred);
      setPhase({ name: "result", cred, result, student: data.student_name, subject: data.subject });
    }
  }, []);

  useEffect(() => {
    const cred = loadCred();
    if (!cred) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase({ name: "login" });
      return;
    }
    enter(cred, false).catch((e) => {
      const msg = errMsg(e);
      // Galat jaringan: biarkan kredensial agar bisa dicoba lagi. Selain itu sesi tidak berlaku.
      if (msg.includes("terhubung")) setPhase({ name: "login", notice: msg });
      else {
        clearCred();
        setPhase({ name: "login", notice: msg });
      }
    });
  }, [enter]);

  async function login(code: string, nisn: string, birth: string) {
    const s = await examStart(code, nisn, birth);
    const cred = { id: s.session_id, key: s.access_key };
    saveCred(cred);
    await enter(cred, true);
  }

  if (phase.name === "loading")
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner label="Menyiapkan ujian…" />
      </main>
    );

  if (phase.name === "login")
    return <LoginForm defaultToken={params.get("token") ?? ""} notice={phase.notice} onLogin={login} />;

  if (phase.name === "exam")
    return (
      <ExamView
        cred={phase.cred}
        data={phase.data}
        offset={phase.offset}
        needsGate={!phase.fresh}
        onDone={(result) =>
          setPhase({
            name: "result",
            cred: phase.cred,
            result,
            student: phase.data.student_name,
            subject: phase.data.subject,
          })
        }
      />
    );

  return (
    <ResultView
      result={phase.result}
      student={phase.student}
      subject={phase.subject}
      onExit={() => {
        clearCred();
        setPhase({ name: "login" });
      }}
    />
  );
}
