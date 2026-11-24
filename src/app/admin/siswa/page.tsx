import type { Metadata } from "next";
import { StudentsClient } from "./StudentsClient";

export const metadata: Metadata = { title: "Siswa" };

export default function SiswaPage() {
  return <StudentsClient />;
}
