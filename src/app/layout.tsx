import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { AuthModal } from "@/components/AuthModal";

export const metadata: Metadata = {
  title: "PrepKit.AI - Personalized Interview Preparation Kit Generator",
  description:
    "Turn any job description and company website into a complete, structured interview prep kit with autonomous research, deterministic scheduling, and active recall practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur-md py-6 text-center text-xs text-slate-500">
              <p>
                TRAO Assessment FS-AI-INTERVIEW-01 • Autonomous Research &amp; Deterministic Schedule Allocator
              </p>
            </footer>
          </div>
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
