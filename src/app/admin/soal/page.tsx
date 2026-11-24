import type { Metadata } from "next";
import { PackagesClient } from "./PackagesClient";

export const metadata: Metadata = { title: "Paket soal" };

export default function SoalPage() {
  return <PackagesClient />;
}
