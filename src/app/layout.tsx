import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SessionGate } from "@/state/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidenceReady",
  description: "Evidence intake for manual authoring readiness",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicDemo = process.env.EVIDENCEREADY_PUBLIC_DEMO === "1";

  return (
    <html lang="en">
      <body>
        <SessionGate publicDemo={publicDemo}>
          <AppShell>{children}</AppShell>
        </SessionGate>
      </body>
    </html>
  );
}
