"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";

interface Branch { id: string; name: string }

export default function ImportForm({ branches }: { branches: Branch[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [branchId, setBranchId] = useState("");
  const [importType, setImportType] = useState<"members" | "payments">("members");
  const [parsed, setParsed] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        // Filter out completely empty rows
        const filtered = (res.data as any[]).filter(row => {
          const vals = Object.values(row).map(v => String(v ?? "").trim());
          return vals.some(v => v !== "" && v !== "0");
        });
        setParsed(filtered);
      },
      error: (err) => setError(err.message),
    });
  }

  async function handleImport() {
    if (!branchId) { setError("Select a branch first."); return; }
    if (parsed.length === 0) { setError("No rows to import."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    setProgress(0);

    const batchSize = 50;
    let totalCreated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    const total = parsed.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = parsed.slice(i, i + batchSize);
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch, branchId, importType }),
        });
        const data = await res.json();
        if (!res.ok) {
          allErrors.push(data.error ?? `Batch ${i}-${i + batchSize} failed`);
          continue;
        }
        totalCreated += data.created ?? 0;
        totalSkipped += data.skipped ?? 0;
        if (data.errors) allErrors.push(...data.errors);
      } catch (err: any) {
        allErrors.push(`Batch error: ${err.message}`);
      }
      setProgress(Math.min(i + batchSize, total));
    }

    setResult({ created: totalCreated, skipped: totalSkipped, errors: allErrors });
    setLoading(false);
  }

  const previewCols = parsed.length > 0 ? Object.keys(parsed[0]).slice(0, 10) : [];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Import Type Tabs */}
        <div>
          <label className="label mb-2">Import Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setImportType("members"); setParsed([]); setFileName(""); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                importType === "members"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Members (Enrollee Details)
            </button>
            <button
              onClick={() => { setImportType("payments"); setParsed([]); setFileName(""); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                importType === "payments"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Payments (Payment Records)
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {importType === "members"
              ? "Upload the \"Plan Holder Enrollee's Details\" CSV to import member profiles and beneficiaries."
              : "Upload the \"Plan Holders Payment Records\" CSV to import payment history. Members must be imported first."
            }
          </p>
        </div>

        {/* Branch */}
        <div>
          <label className="label">Target Branch *</label>
          <select className="input max-w-xs" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select Branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* File Upload */}
        <div>
          <label className="label">CSV File *</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {fileName ? (
              <div>
                <p className="font-medium text-gray-700">{fileName}</p>
                <p className="text-sm text-gray-400 mt-1">{parsed.length} rows parsed</p>
              </div>
            ) : (
              <div>
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-gray-500 text-sm">Click to upload CSV file</p>
                <p className="text-gray-400 text-xs mt-1">
                  {importType === "members" ? "Enrollee Details CSV" : "Payment Records CSV"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        {parsed.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">
              Preview (first 3 rows, {Object.keys(parsed[0]).length} columns)
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    {previewCols.map((k) => (
                      <th key={k} className="pr-4 text-left text-gray-400 pb-1 whitespace-nowrap">{k}</th>
                    ))}
                    {Object.keys(parsed[0]).length > 10 && (
                      <th className="text-gray-300">+{Object.keys(parsed[0]).length - 10} more</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {previewCols.map((k) => (
                        <td key={k} className="pr-4 text-gray-600 pb-1 whitespace-nowrap max-w-[150px] truncate">{row[k] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importType === "payments" && (
              <p className="text-xs text-green-600 mt-2">
                Detected month columns: {Object.keys(parsed[0]).filter(k => {
                  const m = k.trim().toLowerCase().match(/^[a-z]+\d{2,4}$/);
                  return m;
                }).length} months found
              </p>
            )}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

        {/* Progress */}
        {loading && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Importing...</span>
              <span>{progress} / {parsed.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress / parsed.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={loading || parsed.length === 0 || !branchId}
          className={`font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors text-white ${
            importType === "payments"
              ? "bg-green-600 hover:bg-green-700 disabled:bg-green-300"
              : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
          }`}
        >
          {loading
            ? `Importing... (${progress}/${parsed.length})`
            : `Import ${parsed.length} ${importType === "members" ? "Members" : "Payment Records"}`
          }
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.errors.length > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
          <h3 className={`font-semibold mb-3 ${result.errors.length > 0 ? "text-yellow-800" : "text-green-800"}`}>
            Import Complete
          </h3>
          <div className="flex gap-6 text-sm mb-3">
            <span className="text-green-700">
              <strong>{result.created}</strong> {importType === "members" ? "members" : "payments"} created
            </span>
            <span className="text-gray-600"><strong>{result.skipped}</strong> skipped</span>
            {result.errors.length > 0 && (
              <span className="text-red-600"><strong>{result.errors.length}</strong> errors</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="bg-white rounded-lg border border-yellow-200 p-3 max-h-60 overflow-y-auto">
              {result.errors.slice(0, 100).map((e, i) => (
                <p key={i} className="text-xs text-red-600 font-mono">{e}</p>
              ))}
              {result.errors.length > 100 && (
                <p className="text-xs text-gray-400 mt-2">... and {result.errors.length - 100} more errors</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
