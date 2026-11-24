import type { Metadata } from "next";
import { CardsClient } from "./CardsClient";

export const metadata: Metadata = { title: "Cetak kartu peserta" };

export default function KartuPage() {
  return <CardsClient />;
}
