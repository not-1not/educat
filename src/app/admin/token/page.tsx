import type { Metadata } from "next";
import { TokensClient } from "./TokensClient";

export const metadata: Metadata = { title: "Token ujian" };

export default function TokenPage() {
  return <TokensClient />;
}
