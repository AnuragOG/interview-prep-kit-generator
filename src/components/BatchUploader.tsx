"use client";

import React, { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface BatchUploaderProps {
  onSuccess: () => void;
}

export const BatchUploader: React.FC<BatchUploaderProps> = ({ onSuccess }) => {
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleBatchSubmit = async () => {
    if (!fileContent.trim()) {
      setError("Please select a valid JSON file or paste JSON batch cases.");
      return;
    }

    try {
      const parsed = JSON.parse(fileContent);
      if (!Array.isArray(parsed)) {
        throw new Error("File root must be a JSON array: [{ jd, company_url, days }]");
      }

      setLoading(true);
      setError(null);
      setResult(null);

      const res = await fetch("/api/kits/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases: parsed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Batch processing failed");
      }

      setResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to process batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900/60 border border-white/10 rounded-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Batch Role Preparation</h3>
          <p className="text-xs text-slate-400">
            Upload a JSON file containing multiple role descriptions and company URLs to generate multiple kits in one run.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
          <div className="flex items-center gap-2 font-semibold text-sm mb-1 text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Batch Run Complete: {result.succeeded} / {result.total} Kits Generated</span>
          </div>
          <p className="text-slate-300">All successfully generated kits have been saved to your dashboard.</p>
        </div>
      )}

      {/* Drop Zone */}
      <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/40 rounded-xl p-6 text-center transition-all bg-slate-950/40">
        <input
          type="file"
          id="batch-file-input"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="batch-file-input"
          className="cursor-pointer flex flex-col items-center justify-center gap-2"
        >
          <FileText className="w-8 h-8 text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">
            {fileName ? fileName : "Click to select cases.json"}
          </span>
          <span className="text-xs text-slate-500">
            Format: Array of items with <code className="text-indigo-300">{"{ jd, company_url, days }"}</code>
          </span>
        </label>
      </div>

      {/* Or paste directly */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
          Or Paste Cases JSON Directly:
        </label>
        <textarea
          rows={4}
          value={fileContent}
          onChange={(e) => {
            setFileContent(e.target.value);
            setFileName("Pasted JSON Content");
          }}
          placeholder={`[\n  {\n    "id": "case-01",\n    "jd": "Senior Backend Engineer...",\n    "company_url": "https://company.com",\n    "days": 5\n  }\n]`}
          className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <button
        onClick={handleBatchSubmit}
        disabled={loading || !fileContent.trim()}
        className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing Batch Pipeline...</span>
          </>
        ) : (
          <span>Generate All Batch Kits</span>
        )}
      </button>
    </div>
  );
};
