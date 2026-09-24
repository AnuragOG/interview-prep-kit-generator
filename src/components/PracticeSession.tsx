"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Flashcard, Requirement } from "@/types/kit";
import {
  RotateCcw,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Trophy,
  ArrowRight,
  Flame,
  Award,
  Zap,
} from "lucide-react";

interface PracticeSessionProps {
  flashcards: Flashcard[];
  requirements: Requirement[];
  onClose?: () => void;
}

interface CardProgress {
  cardId: string;
  rating: 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
  reviewedAt: number;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({
  flashcards,
  requirements,
  onClose,
}) => {
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [history, setHistory] = useState<CardProgress[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // Initialize or reorder deck by lowest confidence first
  const initDeck = useCallback(() => {
    // Load existing history from localStorage if available
    const saved = localStorage.getItem("prepkit_flashcard_history");
    const parsedHistory: Record<string, number> = saved ? JSON.parse(saved) : {};

    const sorted = [...flashcards].sort((a, b) => {
      const scoreA = parsedHistory[a.id] ?? 0;
      const scoreB = parsedHistory[b.id] ?? 0;
      return scoreA - scoreB; // Lower score reviewed first
    });

    setDeck(sorted);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsComplete(false);
  }, [flashcards]);

  useEffect(() => {
    initDeck();
  }, [initDeck]);

  const currentCard = deck[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;

    // Save rating
    const newProgress: CardProgress = {
      cardId: currentCard.id,
      rating,
      reviewedAt: Date.now(),
    };

    setHistory((prev) => [...prev, newProgress]);

    // Persist in local storage
    const saved = localStorage.getItem("prepkit_flashcard_history");
    const parsedHistory: Record<string, number> = saved ? JSON.parse(saved) : {};
    parsedHistory[currentCard.id] = rating;
    localStorage.setItem("prepkit_flashcard_history", JSON.stringify(parsedHistory));

    // Next card
    if (currentIndex + 1 < deck.length) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setIsComplete(true);
    }
  };

  // Keyboard navigation: Space to flip, 1-4 to rate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === "1") handleRate(1);
        if (e.key === "2") handleRate(2);
        if (e.key === "3") handleRate(3);
        if (e.key === "4") handleRate(4);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, isComplete, currentIndex, deck]);

  if (deck.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-white/10">
        <p className="text-slate-400">No flashcards available in this kit.</p>
      </div>
    );
  }

  // Summary Screen
  if (isComplete) {
    const total = history.length;
    const againCount = history.filter((h) => h.rating === 1).length;
    const hardCount = history.filter((h) => h.rating === 2).length;
    const goodCount = history.filter((h) => h.rating === 3).length;
    const easyCount = history.filter((h) => h.rating === 4).length;
    const masteryScore = total > 0 ? Math.round(((goodCount * 3 + easyCount * 4 + hardCount * 2 + againCount * 1) / (total * 4)) * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto p-8 bg-slate-900/80 border border-white/10 rounded-3xl text-center space-y-6 animate-in zoom-in-95">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Trophy className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold text-white">Practice Session Complete!</h3>
          <p className="text-sm text-slate-400 mt-1">
            You reviewed {total} flashcards with an adaptive confidence mastery score of {masteryScore}%.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div className="text-xl font-bold text-rose-400">{againCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Again</div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="text-xl font-bold text-amber-400">{hardCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Hard</div>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="text-xl font-bold text-blue-400">{goodCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Good</div>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="text-xl font-bold text-emerald-400">{easyCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Easy</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={initDeck}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Practice Again (Weak Spots First)</span>
          </button>
        </div>
      </div>
    );
  }

  const mappedReqs = requirements.filter((r) =>
    currentCard.requirement_ids.includes(r.id)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Session Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg">
            Card {currentIndex + 1} of {deck.length}
          </span>
          {mappedReqs.map((r) => (
            <span
              key={r.id}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                r.priority === "must"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}
            >
              {r.text}
            </span>
          ))}
        </div>

        <span className="text-xs text-slate-500">
          Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-white/10 rounded text-[10px]">Space</kbd> to Flip
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
        />
      </div>

      {/* 3D Flip Card */}
      <div
        onClick={handleFlip}
        className="min-h-[280px] sm:min-h-[320px] cursor-pointer relative glass-card rounded-3xl p-8 flex flex-col justify-between border border-white/10 hover:border-indigo-500/30 transition-all shadow-xl select-none"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-4 font-semibold uppercase tracking-wider">
            <span>{isFlipped ? "Answer Outline" : "Recall Question"}</span>
            <span className="text-indigo-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {isFlipped ? "Click to see prompt" : "Click to reveal answer"}
            </span>
          </div>

          <div className="text-lg sm:text-xl font-medium text-white leading-relaxed whitespace-pre-line">
            {isFlipped ? currentCard.back : currentCard.front}
          </div>
        </div>

        <div className="text-xs text-slate-500 pt-6 border-t border-white/5 flex items-center justify-between">
          <span>Card ID: {currentCard.id}</span>
          <span>{isFlipped ? "Rate your confidence below (1-4)" : "Tap card to flip"}</span>
        </div>
      </div>

      {/* Confidence Rating Buttons */}
      {isFlipped ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => handleRate(1)}
            className="py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all group"
          >
            <span>🔴 Again (1)</span>
            <span className="text-[10px] text-slate-500 group-hover:text-rose-400">Blanked out</span>
          </button>
          <button
            onClick={() => handleRate(2)}
            className="py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all group"
          >
            <span>🟠 Hard (2)</span>
            <span className="text-[10px] text-slate-500 group-hover:text-amber-400">Struggled</span>
          </button>
          <button
            onClick={() => handleRate(3)}
            className="py-3 px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all group"
          >
            <span>🟡 Good (3)</span>
            <span className="text-[10px] text-slate-500 group-hover:text-blue-400">Recalled</span>
          </button>
          <button
            onClick={() => handleRate(4)}
            className="py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all group"
          >
            <span>🟢 Easy (4)</span>
            <span className="text-[10px] text-slate-500 group-hover:text-emerald-400">Instant</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleFlip}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Reveal Answer (or press Space)</span>
        </button>
      )}
    </div>
  );
};
