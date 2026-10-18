import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: `${brand.name} · Trade-based money laundering investigation`,
    template: `%s · ${brand.name}`,
  },
  description:
    "An investigation workspace for financial crime teams that connects invoices, shipments, counterparties and payments to surface and explain trade-based money laundering risk.",
};

export const viewport: Viewport = {
  themeColor: "#07090c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!rounded-md !border !border-border !bg-surface !text-fg !font-sans !text-[13px]",
          }}
        />
      </body>
    </html>
  );
}
