import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { Sidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Enricher",
  description: "Upload CSV lists, enrich them with new columns, and explore the data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(geistSans.variable, geistMono.variable)}>
        <div className="flex min-h-screen bg-background text-foreground">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b px-8 py-6">
              <div className="flex flex-col">
                <span className="text-lg font-semibold">Workspace</span>
                <span className="text-sm text-muted-foreground">
                  Manage your enriched data lists
                </span>
              </div>
              <Link
                href="/lists"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                View lists
              </Link>
            </header>
            <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
