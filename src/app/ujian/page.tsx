import type { Metadata } from "next";
import { Suspense } from "react";
import { ExamApp } from "./ExamApp";

export const metadata: Metadata = { title: "Ujian" };

export default function UjianPage() {
  return (
    <Suspense>
      <ExamApp />
    </Suspense>
  );
}
