import type { Metadata } from "next";
import { ResultsClient } from "./ResultsClient";

export const metadata: Metadata = { title: "Hasil ujian" };

export default function HasilPage() {
  return <ResultsClient />;
}
