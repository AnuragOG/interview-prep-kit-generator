"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { KitBuilder } from "@/components/KitBuilder";
import { PrepKit } from "@/types/kit";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [kit, setKit] = useState<PrepKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const kitId = params.id as string;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }

    const fetchKit = async () => {
      try {
        const res = await fetch(`/api/kits/${kitId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load kit");
        }
        const data = await res.json();
        setKit(data.kit);
      } catch (err: any) {
        setError(err.message || "Failed to load interview kit");
      } finally {
        setLoading(false);
      }
    };

    fetchKit();
  }, [kitId, user, authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading interview preparation kit...</p>
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error || "Kit not found"}</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <KitBuilder kitId={kitId} initialKit={kit} />
    </div>
  );
}
