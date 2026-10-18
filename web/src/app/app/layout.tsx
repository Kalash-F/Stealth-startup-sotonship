import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: { default: "Demo workspace", template: "%s · Demo workspace" },
  robots: { index: false },
};

/** Restores the saved colour mode before the first paint, so a dark workspace never flashes beige on load. */
const restoreMode = `try{if(localStorage.getItem("ws-mode")==="dark")document.documentElement.dataset.wsMode="dark"}catch(e){}`;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: restoreMode }} />
      <AppShell>{children}</AppShell>
    </>
  );
}
