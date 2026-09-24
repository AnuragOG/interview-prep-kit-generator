"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, User, LogOut, FileText, Compass, Zap } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, openAuthModal, loading } = useAuth();

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400 group-hover:text-cyan-300 transition-colors" />
              </div>
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                PrepKit<span className="text-indigo-400">.AI</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 rounded-full">
                TRAO-FS-AI-01
              </span>
            </div>
          </Link>

          {/* Navigation Items */}
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Kits</span>
            </Link>

            {loading ? (
              <div className="w-20 h-8 bg-slate-800/50 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-lg text-xs text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-medium">{user.email}</span>
                </div>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg transition-all flex items-center gap-1.5"
                  title="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthModal("login")}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-white/10 rounded-lg transition-all"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal("register")}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-lg shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Get Started</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
