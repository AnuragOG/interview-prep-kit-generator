"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  Globe,
  Calendar,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Search,
} from "lucide-react";

export const KitCreator: React.FC = () => {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const samplePresets = [
    {
      label: "Senior Backend (Go / Microservices)",
      url: "https://stripe.com",
      days: 5,
      jd: `Senior Backend Engineer - Core Infrastructure
Stripe is looking for a Senior Backend Engineer to design and scale distributed financial infrastructure.

Responsibilities:
• Architect resilient, high-throughput transaction processing systems.
• Design fault-tolerant APIs handling millions of requests per second.
• Lead architectural reviews and mentor junior and mid-level software engineers.
• Collaborate with product and risk teams to define SLA and reliability targets.

Requirements:
• 5+ years of experience with Go, Java, or Rust in production environments (Required).
• Deep understanding of distributed systems, ACID transactions, and consensus protocols (Must have).
• Extensive experience with PostgreSQL database indexing, sharding, and query optimization (Essential).
• Proven track record leading post-mortems and incident management (Must have).
• Bonus: Experience with Kafka event streaming and Kubernetes (Nice to have).
• Bonus: Background in PCI-DSS compliance or fintech security (Nice to have).`,
    },
    {
      label: "Full Stack Engineer (React / Node)",
      url: "https://posthog.com",
      days: 3,
      jd: `Full Stack Engineer - Product Analytics
We are seeking an autonomous Full Stack Engineer to build next-generation product analytics tooling.

Key Requirements:
• 4+ years building responsive modern web applications with React, TypeScript, and Next.js (Must).
• Strong backend proficiency in Node.js / Python and building performant GraphQL and REST APIs (Required).
• Experience troubleshooting client-side performance, state management, and memory leaks (Must).
• High autonomy, empathy, and clear written communication in an open-source team (Essential).
• Plus: Experience with ClickHouse or high-volume analytics databases (Nice to have).`,
    },
  ];

  const handleApplyPreset = (preset: (typeof samplePresets)[0]) => {
    setJd(preset.jd);
    setCompanyUrl(preset.url);
    setDays(preset.days);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim()) {
      setError("Please paste a job description.");
      return;
    }

    if (!user) {
      openAuthModal("login");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressPercent(5);
    setCurrentStep("Initializing research and extraction pipeline...");

    try {
      // Initiate streaming pipeline
      const res = await fetch("/api/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd,
          company_url: companyUrl || "https://example.com",
          days,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to start kit generation");
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Streaming is not supported by browser or server.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.substring(6));
              if (event.percentage) setProgressPercent(event.percentage);
              if (event.message) setCurrentStep(event.message);

              if (event.step === "completed" && event.kitId) {
                setProgressPercent(100);
                setTimeout(() => {
                  router.push(`/kits/${event.kitId}`);
                }, 500);
                return;
              }

              if (event.step === "failed") {
                throw new Error(event.error || event.message);
              }
            } catch (err: any) {
              if (err.message && !err.message.includes("JSON")) {
                throw err;
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during kit generation.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative glass-card rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl shadow-indigo-950/40">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Autonomous Multi-Pass Pipeline
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create Tailored Interview Prep Kit
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Paste any job description and company site. Our crawler discovers their hiring process, extracts requirements, checks gaps, and arithmetic-schedules your prep.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Try Sample:</span>
          {samplePresets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-2.5 py-1 text-xs bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-sm text-rose-300 animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Generation In-Progress Visualizer */}
      {isGenerating ? (
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-blue-500 to-cyan-400 animate-spin blur-md opacity-50" />
            <div className="relative w-full h-full rounded-full bg-slate-950 border border-indigo-500/40 flex items-center justify-center">
              <Cpu className="w-10 h-10 text-indigo-400 animate-pulse" />
            </div>
          </div>

          <div className="max-w-md w-full space-y-3">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{currentStep || "Processing..."}</span>
              <span className="text-indigo-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Detailed Sequence Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full text-left text-xs mt-4">
            <div
              className={`p-3 rounded-xl border transition-all ${
                progressPercent >= 20
                  ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                  : "bg-slate-900/40 border-white/5 text-slate-500"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> 1. JD Extraction
              </div>
              <p className="text-[11px] text-slate-400">Stable IDs, Must/Nice tags</p>
            </div>

            <div
              className={`p-3 rounded-xl border transition-all ${
                progressPercent >= 45
                  ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                  : "bg-slate-900/40 border-white/5 text-slate-500"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> 2. Intelligent Crawl
              </div>
              <p className="text-[11px] text-slate-400">Discover hiring & culture</p>
            </div>

            <div
              className={`p-3 rounded-xl border transition-all ${
                progressPercent >= 80
                  ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                  : "bg-slate-900/40 border-white/5 text-slate-500"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> 3. Multi-Pass Loop
              </div>
              <p className="text-[11px] text-slate-400">Deterministic gap resolution</p>
            </div>

            <div
              className={`p-3 rounded-xl border transition-all ${
                progressPercent >= 95
                  ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                  : "bg-slate-900/40 border-white/5 text-slate-500"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> 4. Allocation
              </div>
              <p className="text-[11px] text-slate-400">Arithmetic day schedule</p>
            </div>
          </div>
        </div>
      ) : (
        /* Input Form */
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Company Website URL */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Company Website Address
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="e.g. https://stripe.com or https://company.com"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                The crawler will autonomously discover their /careers, /jobs, handbook, or engineering blogs.
              </p>
            </div>

            {/* Days Available Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Days Available
                </label>
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-md">
                  {days} {days === 1 ? "Day" : "Days"}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 bg-slate-950/80 border border-white/10 rounded-xl px-2 py-1.5 text-center text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Exact day binning with prioritized difficulty distribution.
              </p>
            </div>
          </div>

          {/* Job Description Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Job Description (Pasted Text)
            </label>
            <div className="relative">
              <textarea
                required
                rows={8}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job posting here (Title, Responsibilities, Must-Have Requirements, Bonus points)..."
                className="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans leading-relaxed"
              />
              <div className="absolute bottom-3.5 right-4 text-xs text-slate-500">
                {jd.length} characters
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-pass coverage verification &amp; SSRF safe</span>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm rounded-xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 group-hover:rotate-12 transition-transform" />
              <span>Generate Structured Prep Kit</span>
              <ArrowRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
