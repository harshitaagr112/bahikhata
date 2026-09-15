import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { AuthGate } from "@/components/AuthGate";
import { RouteTracker } from "@/components/RouteTracker";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Khata — Family Insurance Ledger",
  description: "Daybook, ledgers and outstanding management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <AuthGate>
          <RouteTracker />
          <KeyboardShortcuts />
          <div className="flex h-full flex-col md:flex-row">
            <Nav />
            <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8 md:px-8">
              <div className="mx-auto w-full max-w-4xl">{children}</div>
            </main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
