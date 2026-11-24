import type { Metadata } from "next";
import { QuestionsClient } from "./QuestionsClient";

export const metadata: Metadata = { title: "Kelola soal" };

export default function PaketPage() {
  return <QuestionsClient />;
}
