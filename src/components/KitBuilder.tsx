"use client";

import React, { useState } from "react";
import {
  PrepKit,
  Question,
  QuestionCategory,
  Flashcard,
  Requirement,
} from "@/types/kit";
import { PracticeSession } from "./PracticeSession";
import { MockInterviewModal } from "./MockInterviewModal";
import {
  Building2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Edit3,
  Trash2,
  Pin,
  Plus,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Clock,
  Printer,
  Copy,
  Check,
  Award,
  BookOpen,
  ArrowRightLeft,
} from "lucide-react";

interface KitBuilderProps {
  kitId: string;
  initialKit: PrepKit;
}

export const KitBuilder: React.FC<KitBuilderProps> = ({ kitId, initialKit }) => {
  const [kit, setKit] = useState<PrepKit>(initialKit);
  const [activeTab, setActiveTab] = useState<
    "overview" | "questions" | "flashcards" | "practice" | "schedule" | "json"
  >("overview");
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | "all">("all");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);
  const [mockQuestion, setMockQuestion] = useState<Question | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Synchronize changes to server
  const saveKitToServer = async (updated: PrepKit) => {
    setKit(updated);
    setIsSaving(true);
    try {
      await fetch(`/api/kits/${kitId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kit: updated }),
      });
    } catch {
      // silent retry
    } finally {
      setIsSaving(false);
    }
  };

  // ----------------------------------------------------
  // Regeneration Actions
  // ----------------------------------------------------
  const handleRegenerateSection = async (
    target: "company_brief" | "category" | "flashcards" | "schedule",
    category?: QuestionCategory
  ) => {
    setIsRegenerating(true);
    setRegenMessage(null);
    try {
      const res = await fetch(`/api/kits/${kitId}/regenerate-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, category }),
      });
      const data = await res.json();
      if (res.ok && data.kit) {
        setKit(data.kit);
        setRegenMessage(data.message || `Section '${target}' regenerated successfully.`);
        setTimeout(() => setRegenMessage(null), 4000);
      }
    } catch {
      setRegenMessage("Failed to regenerate section.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // ----------------------------------------------------
  // Question Manipulation
  // ----------------------------------------------------
  const handleUpdateQuestion = (
    qId: string,
    updates: Partial<Question>
  ) => {
    const updated = {
      ...kit,
      questions: kit.questions.map((q) =>
        q.id === qId ? { ...q, ...updates, origin: "edited" as const } : q
      ),
    };
    saveKitToServer(updated);
  };

  const handleTogglePinQuestion = (qId: string) => {
    const updated = {
      ...kit,
      questions: kit.questions.map((q) =>
        q.id === qId ? { ...q, pinned: !q.pinned } : q
      ),
    };
    saveKitToServer(updated);
  };

  const handleDeleteQuestion = (qId: string) => {
    const updated = {
      ...kit,
      questions: kit.questions.filter((q) => q.id !== qId),
    };
    saveKitToServer(updated);
  };

  const handleAddQuestion = () => {
    const newId = `q${kit.questions.length + 1}_manual`;
    const newQ: Question = {
      id: newId,
      requirement_ids: kit.role.requirements.slice(0, 1).map((r) => r.id),
      category: selectedCategory === "all" ? "technical" : selectedCategory,
      prompt: "New Custom Interview Question",
      answer_outline: "- Key talking point 1\n- Key talking point 2",
      difficulty: 2,
      origin: "manual",
      pinned: true,
    };
    const updated = {
      ...kit,
      questions: [newQ, ...kit.questions],
    };
    saveKitToServer(updated);
  };

  // ----------------------------------------------------
  // Flashcard Manipulation
  // ----------------------------------------------------
  const handleUpdateFlashcard = (fId: string, updates: Partial<Flashcard>) => {
    const updated = {
      ...kit,
      flashcards: kit.flashcards.map((f) =>
        f.id === fId ? { ...f, ...updates, origin: "edited" as const } : f
      ),
    };
    saveKitToServer(updated);
  };

  const handleDeleteFlashcard = (fId: string) => {
    const updated = {
      ...kit,
      flashcards: kit.flashcards.filter((f) => f.id !== fId),
    };
    saveKitToServer(updated);
  };

  const handleAddFlashcard = () => {
    const newF: Flashcard = {
      id: `f${kit.flashcards.length + 1}_manual`,
      front: "New Technical Concept / Recall Question",
      back: "- Bulleted answer summary\n- Core trade-offs",
      requirement_ids: kit.role.requirements.slice(0, 1).map((r) => r.id),
      origin: "manual",
      pinned: true,
    };
    const updated = {
      ...kit,
      flashcards: [newF, ...kit.flashcards],
    };
    saveKitToServer(updated);
  };

  const filteredQuestions =
    selectedCategory === "all"
      ? kit.questions
      : kit.questions.filter((q) => q.category === selectedCategory);

  const coveredReqCount =
    kit.role.requirements.length - kit.coverage.uncovered_requirement_ids.length;
  const coveragePercent =
    kit.role.requirements.length > 0
      ? Math.round((coveredReqCount / kit.role.requirements.length) * 100)
      : 100;

  return (
    <div className="space-y-8">
      {/* Mock Interview Modal */}
      {mockQuestion && (
        <MockInterviewModal
          kitId={kitId}
          question={mockQuestion}
          onClose={() => setMockQuestion(null)}
        />
      )}

      {/* Kit Master Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-lg uppercase tracking-wider">
                {kit.role.seniority} {kit.role.title}
              </span>
              <span className="px-3 py-1 bg-slate-900 text-slate-300 border border-white/10 text-xs font-medium rounded-lg flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {kit.source.company}
              </span>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Coverage: {coveragePercent}% ({kit.coverage.passes} Pass{kit.coverage.passes > 1 ? "es" : ""})
              </span>
              {isSaving && (
                <span className="text-xs text-indigo-400 animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Saving changes...
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Interview Prep Kit: {kit.role.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Crawled from{" "}
              <a
                href={kit.source.company_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                {kit.source.company_url} <ExternalLink className="w-3 h-3" />
              </a>{" "}
              • Researched {new Date(kit.source.researched_at).toLocaleDateString()}
            </p>
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("practice")}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <Award className="w-4 h-4" />
              <span>Practice Mode</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
              title="Print 1-Page Cheatsheet"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {regenMessage && (
          <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-cyan-300 flex-shrink-0" />
            <span>{regenMessage}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Company &amp; Role Overview
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "questions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Question Bank ({kit.questions.length})
          </button>
          <button
            onClick={() => setActiveTab("flashcards")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "flashcards"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Flashcards ({kit.flashcards.length})
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "schedule"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Day-by-Day Schedule ({kit.schedule.days_available}d)
          </button>
          <button
            onClick={() => setActiveTab("practice")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "practice"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Award className="w-3.5 h-3.5 text-emerald-400" /> Active Practice
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "json"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Copy className="w-3.5 h-3.5" /> Appendix A JSON
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: OVERVIEW & COMPANY BRIEF                      */}
      {/* ==================================================== */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          {/* Company Brief Card */}
          <div className="lg:col-span-2 glass-card rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" /> Company Intelligence Brief
              </h3>
              <button
                onClick={() => handleRegenerateSection("company_brief")}
                disabled={isRegenerating}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                <span>Regenerate Brief</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Executive Summary
              </label>
              <textarea
                rows={3}
                value={kit.company_brief.summary}
                onChange={(e) =>
                  saveKitToServer({
                    ...kit,
                    company_brief: { ...kit.company_brief, summary: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                What They Do (Product &amp; Domain)
              </label>
              <textarea
                rows={3}
                value={kit.company_brief.what_they_do}
                onChange={(e) =>
                  saveKitToServer({
                    ...kit,
                    company_brief: { ...kit.company_brief, what_they_do: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Hiring Process Structure
              </label>
              <textarea
                rows={2}
                value={kit.company_brief.hiring_process_notes || ""}
                onChange={(e) =>
                  saveKitToServer({
                    ...kit,
                    company_brief: {
                      ...kit.company_brief,
                      hiring_process_notes: e.target.value,
                    },
                  })
                }
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            {/* Sources Crawled */}
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Pages Crawled &amp; Used
              </div>
              <div className="flex flex-wrap gap-2">
                {kit.company_brief.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-slate-950 border border-white/10 rounded-lg text-xs text-indigo-300 hover:underline flex items-center gap-1"
                  >
                    <span>{src}</span> <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Role Requirements Checklist Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Extracted Requirements
            </h3>

            <div className="space-y-3">
              {kit.role.requirements.map((r) => {
                const isUncovered = kit.coverage.uncovered_requirement_ids.includes(r.id);
                return (
                  <div
                    key={r.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isUncovered
                        ? "bg-rose-500/5 border-rose-500/30"
                        : "bg-slate-950/60 border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs text-indigo-400 font-bold">[{r.id}]</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.priority === "must"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {r.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400 border border-white/5 uppercase">
                          {r.kind}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200">{r.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: QUESTION BANK & BUILDER                      */}
      {/* ==================================================== */}
      {activeTab === "questions" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Category Filter & Actions Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "technical", "behavioural", "system-design", "company-fit"] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                      selectedCategory === cat
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-950/60 text-slate-400 hover:text-white border border-white/5"
                    }`}
                  >
                    {cat.replace("-", " ")}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedCategory !== "all" && (
                <button
                  onClick={() => handleRegenerateSection("category", selectedCategory)}
                  disabled={isRegenerating}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Regenerates only generated items. Pinned and user-edited questions are preserved!"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                  <span>Regenerate Category</span>
                </button>
              )}

              <button
                onClick={handleAddQuestion}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {filteredQuestions.map((q) => (
              <div
                key={q.id}
                className={`glass-card rounded-2xl p-6 border transition-all ${
                  q.pinned ? "border-amber-500/40 bg-amber-950/10" : "border-white/10"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400">[{q.id}]</span>
                    {/* Category Switcher Dropdown */}
                    <select
                      value={q.category}
                      onChange={(e) =>
                        handleUpdateQuestion(q.id, {
                          category: e.target.value as QuestionCategory,
                        })
                      }
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 capitalize"
                    >
                      <option value="technical">Technical</option>
                      <option value="behavioural">Behavioural</option>
                      <option value="system-design">System Design</option>
                      <option value="company-fit">Company Fit</option>
                    </select>

                    {/* Difficulty Selector */}
                    <select
                      value={q.difficulty}
                      onChange={(e) =>
                        handleUpdateQuestion(q.id, {
                          difficulty: parseInt(e.target.value, 10) as 1 | 2 | 3,
                        })
                      }
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1">Difficulty 1 (Fundamental)</option>
                      <option value="2">Difficulty 2 (Practical)</option>
                      <option value="3">Difficulty 3 (Deep Dive)</option>
                    </select>

                    {/* Requirements Mapped Badges */}
                    {q.requirement_ids.map((rId) => (
                      <span
                        key={rId}
                        className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-md text-[10px] font-mono font-bold"
                      >
                        {rId}
                      </span>
                    ))}

                    {q.origin && q.origin !== "generated" && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md text-[10px] font-semibold uppercase">
                        {q.origin}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Mock Interview Bar Raiser Button */}
                    <button
                      onClick={() => setMockQuestion(q)}
                      className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Mock Interview</span>
                    </button>

                    {/* Pin/Protect Toggle */}
                    <button
                      onClick={() => handleTogglePinQuestion(q.id)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        q.pinned
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "text-slate-400 hover:text-white border-transparent hover:bg-slate-800"
                      }`}
                      title={q.pinned ? "Pinned (Protected from regeneration)" : "Pin to protect from regeneration"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Question */}
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Editable Question Prompt */}
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Question Prompt
                  </label>
                  <textarea
                    rows={2}
                    value={q.prompt}
                    onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                    className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3 text-sm font-medium text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Inline Editable Answer Outline */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Answer Outline &amp; Key Concepts
                  </label>
                  <textarea
                    rows={3}
                    value={q.answer_outline}
                    onChange={(e) =>
                      handleUpdateQuestion(q.id, { answer_outline: e.target.value })
                    }
                    className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 whitespace-pre-line leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: FLASHCARDS DECK                               */}
      {/* ==================================================== */}
      {activeTab === "flashcards" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between glass-card p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">Active Recall Flashcards</h3>
              <p className="text-xs text-slate-400">
                High-yield conceptual triggers mapped to core job requirements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRegenerateSection("flashcards")}
                disabled={isRegenerating}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                <span>Regenerate Deck</span>
              </button>
              <button
                onClick={handleAddFlashcard}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kit.flashcards.map((fc) => (
              <div
                key={fc.id}
                className="glass-card rounded-2xl p-5 border border-white/10 space-y-4"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono font-bold text-indigo-400">[{fc.id}]</span>
                  <div className="flex items-center gap-1.5">
                    {fc.requirement_ids.map((rId) => (
                      <span
                        key={rId}
                        className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[10px] font-mono"
                      >
                        {rId}
                      </span>
                    ))}
                    <button
                      onClick={() => handleDeleteFlashcard(fc.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Front (Question/Prompt)
                  </label>
                  <textarea
                    rows={2}
                    value={fc.front}
                    onChange={(e) => handleUpdateFlashcard(fc.id, { front: e.target.value })}
                    className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Back (Recall Answer Outline)
                  </label>
                  <textarea
                    rows={3}
                    value={fc.back}
                    onChange={(e) => handleUpdateFlashcard(fc.id, { back: e.target.value })}
                    className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: DAY-BY-DAY STUDY SCHEDULE                    */}
      {/* ==================================================== */}
      {activeTab === "schedule" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between glass-card p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">
                {kit.schedule.days_available}-Day Arithmetic Schedule
              </h3>
              <p className="text-xs text-slate-400">
                Deterministic difficulty-weighted allocation. Harder &amp; must-have concepts land earlier.
              </p>
            </div>

            <button
              onClick={() => handleRegenerateSection("schedule")}
              disabled={isRegenerating}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
              <span>Re-calculate Schedule</span>
            </button>
          </div>

          <div className="space-y-4">
            {kit.schedule.days.map((day) => {
              const dayQuestions = kit.questions.filter((q) =>
                day.question_ids.includes(q.id)
              );

              return (
                <div
                  key={day.day}
                  className="glass-card rounded-2xl p-6 border border-white/10 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-sm">
                        Day {day.day}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{day.focus}</h4>
                        <p className="text-xs text-slate-400">
                          {day.question_ids.length} Question{day.question_ids.length > 1 ? "s" : ""} Assigned
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-slate-950 border border-white/10 text-xs font-mono font-semibold text-cyan-300 rounded-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        {day.minutes} mins (Integer)
                      </span>
                    </div>
                  </div>

                  {/* Questions in Day */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {dayQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-3 bg-slate-950/70 border border-white/10 rounded-xl space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-indigo-400 font-bold">[{q.id}]</span>
                          <span className="capitalize text-slate-400 font-medium">
                            {q.category} (Diff: {q.difficulty})
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium line-clamp-2">
                          {q.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: ACTIVE PRACTICE MODE                         */}
      {/* ==================================================== */}
      {activeTab === "practice" && (
        <div className="animate-in fade-in py-4">
          <PracticeSession
            flashcards={kit.flashcards}
            requirements={kit.role.requirements}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 6: APPENDIX A RAW JSON EXPORT                   */}
      {/* ==================================================== */}
      {activeTab === "json" && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Appendix A Kit JSON</h3>
              <p className="text-xs text-slate-400">
                Exact schema match conforming to Section 5 and Appendix A specifications.
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(kit, null, 2));
                setCopiedJson(true);
                setTimeout(() => setCopiedJson(false), 2000);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 bg-slate-950 border border-white/10 rounded-2xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-[500px]">
            {JSON.stringify(kit, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
