"use client";

import React, { useState } from "react";
import { Question } from "@/types/kit";
import { MockEvaluationResult } from "@/app/api/kits/[id]/mock-interview/route";
import {
  X,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
  ChevronRight,
  MessageSquare,
} from "lucide-react";

interface MockInterviewModalProps {
  kitId: string;
  question: Question;
  onClose: () => void;
}

export const MockInterviewModal: React.FC<MockInterviewModalProps> = ({
  kitId,
  question,
  onClose,
}) => {
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<MockEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateAnswer.trim()) {
      setError("Please provide your answer to receive an evaluation.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/kits/${kitId}/mock-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          candidateAnswer,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Evaluation failed");
      }

      setEvaluation(data.evaluation);
    } catch (err: any) {
      setError(err.message || "Failed to evaluate response.");
    } finally {
      setLoading(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "Strong Hire":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "Hire":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "Leaning Hire":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      default:
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">AI Bar Raiser Mock Interview</h3>
            <p className="text-xs text-slate-400">
              Category: <span className="capitalize font-semibold text-indigo-400">{question.category}</span> | Difficulty: {question.difficulty}/3
            </p>
          </div>
        </div>

        {/* Question Prompt Box */}
        <div className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl mb-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Interview Question
          </div>
          <p className="text-base text-white font-medium">{question.prompt}</p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Evaluation Output */}
        {evaluation ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Score & Verdict Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-slate-950/80 border border-white/10 rounded-2xl gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-2xl font-black text-indigo-300">
                  {evaluation.score}<span className="text-xs text-slate-500 font-normal">/10</span>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Evaluation Verdict</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mt-1 ${getVerdictColor(evaluation.verdict)}`}>
                    {evaluation.verdict}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setEvaluation(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
              >
                Re-try Answer
              </button>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                  <CheckCircle2 className="w-4 h-4" /> Strong Points Hit
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {evaluation.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" /> Areas for Improvement
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {evaluation.weaknesses.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Exemplary Model Answer */}
            <div className="p-5 bg-slate-950 border border-white/10 rounded-2xl">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" /> Exemplary Staff Engineer Model Answer
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {evaluation.exemplaryModelAnswer}
              </p>
            </div>

            {/* Probing Follow-Up Question */}
            <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl">
              <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-cyan-400" /> Realistic Interviewer Follow-Up Question:
              </div>
              <p className="text-xs italic text-indigo-100 font-medium">
                &ldquo;{evaluation.followUpQuestion}&rdquo;
              </p>
            </div>
          </div>
        ) : (
          /* Answer Input Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Your Answer (Type or outline how you would respond in the live interview)
              </label>
              <textarea
                required
                rows={6}
                value={candidateAnswer}
                onChange={(e) => setCandidateAnswer(e.target.value)}
                placeholder="Walk through your reasoning, architecture, concrete examples, or STAR framework..."
                className="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !candidateAnswer.trim()}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Response...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Evaluate My Answer</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
