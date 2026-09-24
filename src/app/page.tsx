"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { KitCreator } from "@/components/KitCreator";
import { BatchUploader } from "@/components/BatchUploader";
import { PrepKit } from "@/types/kit";
import {
  Sparkles,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Trash2,
  CheckCircle2,
  Plus,
  Zap,
  FolderKanban,
} from "lucide-react";

export default function HomePage() {
  const { user, openAuthModal, loading } = useAuth();
  const [creatorMode, setCreatorMode] = useState<"single" | "batch">("single");
  const [kits, setKits] = useState<Array<{ id: string; kit: PrepKit; createdAt: string }>>([]);
  const [loadingKits, setLoadingKits] = useState(false);

  const fetchKits = async () => {
    if (!user) return;
    setLoadingKits(true);
    try {
      const res = await fetch("/api/kits");
      if (res.ok) {
        const data = await res.json();
        setKits(data.kits || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingKits(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchKits();
    } else {
      setKits([]);
    }
  }, [user]);

  const handleDeleteKit = async (e: React.MouseEvent, kitId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this prep kit?")) return;

    try {
      const res = await fetch(`/api/kits/${kitId}`, { method: "DELETE" });
      if (res.ok) {
        setKits((prev) => prev.filter((k) => k.id !== kitId));
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-cyan-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide">
          <Zap className="w-3.5 h-3.5 text-cyan-300" />
          Engineered for Deep Role &amp; Company Preparation
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Turn Any Job Description Into a{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
            Personalized Prep Kit
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
          Autonomous company crawling, intelligent link discovery, multi-pass coverage gap resolution, and arithmetic-based day-by-day study scheduling.
        </p>

        {/* Creator Mode Switcher */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setCreatorMode("single")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              creatorMode === "single"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            Single Role Kit
          </button>
          <button
            onClick={() => setCreatorMode("batch")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              creatorMode === "batch"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            Batch / Multi-Role File Upload
          </button>
        </div>
      </div>

      {/* Main Kit Creator / Batch Uploader */}
      <div>
        {creatorMode === "single" ? (
          <KitCreator />
        ) : (
          <BatchUploader onSuccess={fetchKits} />
        )}
      </div>

      {/* User Kits Dashboard */}
      {user && (
        <div className="space-y-6 pt-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Your Saved Preparation Kits</h2>
              <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-white/10 rounded-full text-xs font-semibold">
                {kits.length}
              </span>
            </div>
          </div>

          {loadingKits ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 glass-card rounded-2xl animate-pulse border border-white/5"
                />
              ))}
            </div>
          ) : kits.length === 0 ? (
            <div className="p-12 text-center glass-card rounded-2xl border border-white/10">
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-white">No prep kits generated yet</h3>
              <p className="text-xs text-slate-400 mt-1">
                Paste a job description above to generate your first custom interview prep kit.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kits.map(({ id, kit, createdAt }) => {
                const coveredReqs =
                  kit.role.requirements.length -
                  kit.coverage.uncovered_requirement_ids.length;
                const coveragePercent =
                  kit.role.requirements.length > 0
                    ? Math.round((coveredReqs / kit.role.requirements.length) * 100)
                    : 100;

                return (
                  <Link
                    key={id}
                    href={`/kits/${id}`}
                    className="glass-card glass-card-hover rounded-2xl p-5 border border-white/10 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {kit.role.seniority}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {coveragePercent}%
                          </span>
                          <button
                            onClick={(e) => handleDeleteKit(e, id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                            title="Delete kit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {kit.role.title}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{kit.source.company}</span>
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {kit.schedule.days_available}d plan ({kit.questions.length} questions)
                      </span>
                      <span className="text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        Open <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
