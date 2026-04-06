"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import ClaimCertificate from "./ClaimCertificate";

interface Doc { id: string; docType: string; fileName: string; fileData: string; createdAt: string }

interface ClaimData {
  id: string; claimNo: string; memberId: string; branchId: string;
  deceasedType: string; deceasedName: string; dateOfDeath: string; causeOfDeath: string | null;
  claimantName: string; claimantRelationship: string; claimantContact: string | null; claimantAddress: string | null;
  planCategory: string; approvedAmount: number | null; releasedAmount: number | null;
  totalPlanAmount: number; dateReleased: string | null; status: string; filedDate: string;
  submittedToHO: string | null; approvedDate: string | null;
  notes: string | null; rejectionReason: string | null;
  documents: Doc[];
  member: { mafNo: string; firstName: string; lastName: string; planCategory: string; branch: string };
}

const STATUS_FLOW = [
  { key: "STUB_ISSUED", label: "Stub Issued" },
  { key: "REQUIREMENTS_SUBMITTED", label: "Docs Submitted" },
  { key: "SUBMITTED_TO_HO", label: "Sent to HO" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "RELEASED", label: "Released" },
];

const DOC_TYPES = [
  "DEATH_CERTIFICATE", "MARRIAGE_CERTIFICATE", "BIRTH_CERTIFICATE",
  "VALID_ID", "BARANGAY_CERTIFICATE", "POLICE_REPORT", "MEDICAL_CERTIFICATE", "OTHER",
];

export default function ClaimDetail({ claim, isAdmin }: { claim: ClaimData; isAdmin: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState(String(claim.approvedAmount ?? ""));
  const [showCert, setShowCert] = useState(false);
  const [docType, setDocType] = useState("DEATH_CERTIFICATE");
  const fileRef = useRef<HTMLInputElement>(null);

  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === claim.status);

  async function updateStatus(newStatus: string) {
    setLoading(true); setMsg("");
    try {
      const body: any = { id: claim.id, status: newStatus };
      if (newStatus === "APPROVED" && amount) body.approvedAmount = parseFloat(amount);
      if (newStatus === "RELEASED" && amount) body.releasedAmount = parseFloat(amount);
      const res = await fetch("/api/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Status updated!");
      router.refresh();
    } catch (e: any) { setMsg("Error: " + e.message); }
    finally { setLoading(false); }
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setMsg("File too large (max 3MB)"); return; }
    setLoading(true); setMsg("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/claims/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId: claim.id, docType, fileName: file.name, fileData: reader.result }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
        setMsg("Document uploaded!");
        router.refresh();
      } catch (e: any) { setMsg("Error: " + e.message); }
      finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  }

  async function deleteDoc(docId: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/claims/documents?id=${docId}`, { method: "DELETE" });
    router.refresh();
  }

  if (showCert) {
    return <ClaimCertificate claim={claim} onBack={() => setShowCert(false)} />;
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claim {claim.claimNo}</h1>
          <p className="text-gray-500 text-sm">{claim.member.mafNo} · {claim.member.firstName} {claim.member.lastName}</p>
        </div>
        <div className="flex gap-2">
          {claim.status === "RELEASED" && (
            <button onClick={() => setShowCert(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Print Certificate
            </button>
          )}
          <Link href="/claims" className="text-sm text-purple-600 hover:underline py-2">Back to Claims</Link>
        </div>
      </div>

      {msg && <div className={`px-4 py-2 rounded-lg text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg}</div>}

      {/* Status Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Claim Status</h2>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const active = s.key === claim.status;
            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                  active ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}>
                  {done && !active && <span>✓</span>}
                  {s.label}
                </div>
                {i < STATUS_FLOW.length - 1 && <div className={`w-4 h-0.5 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            );
          })}
          {claim.status === "REJECTED" && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white ml-2">REJECTED</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Deceased & Claimant Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Deceased</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Name</p><p className="font-bold">{claim.deceasedName}</p></div>
            <div><p className="text-xs text-gray-400">Type</p><p className="font-bold">{claim.deceasedType}</p></div>
            <div><p className="text-xs text-gray-400">Date of Death</p><p className="font-bold">{fmtDate(claim.dateOfDeath)}</p></div>
            <div><p className="text-xs text-gray-400">Cause</p><p className="font-bold">{claim.causeOfDeath || "—"}</p></div>
          </div>
          <hr />
          <h2 className="font-semibold text-gray-800">Claimant</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Name</p><p className="font-bold">{claim.claimantName}</p></div>
            <div><p className="text-xs text-gray-400">Relationship</p><p className="font-bold">{claim.claimantRelationship || "—"}</p></div>
            <div><p className="text-xs text-gray-400">Contact</p><p className="font-bold">{claim.claimantContact || "—"}</p></div>
            <div><p className="text-xs text-gray-400">Address</p><p className="font-bold">{claim.claimantAddress || "—"}</p></div>
          </div>
          <hr />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Plan</p><p className="font-bold">{claim.planCategory}</p></div>
            <div><p className="text-xs text-gray-400">Plan Amount</p><p className="font-bold">{formatCurrency(claim.totalPlanAmount)}</p></div>
            <div><p className="text-xs text-gray-400">Filed Date</p><p className="font-bold">{fmtDate(claim.filedDate)}</p></div>
            <div><p className="text-xs text-gray-400">Branch</p><p className="font-bold">{claim.member.branch}</p></div>
          </div>
        </div>

        {/* Actions & Amount */}
        <div className="space-y-5">
          {/* Approved/Released Amount */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3">Claim Amount</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Approved Amount</label>
              <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount to approve"
                disabled={claim.status === "RELEASED"} />
            </div>
            {claim.approvedAmount && (
              <p className="mt-2 text-sm">Approved: <strong className="text-green-700">{formatCurrency(claim.approvedAmount)}</strong></p>
            )}
            {claim.releasedAmount && (
              <p className="text-sm">Released: <strong className="text-green-700">{formatCurrency(claim.releasedAmount)}</strong> on {fmtDate(claim.dateReleased)}</p>
            )}
          </div>

          {/* Status Actions */}
          {claim.status !== "RELEASED" && claim.status !== "REJECTED" && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Actions</h2>
              <div className="flex flex-wrap gap-2">
                {claim.status === "STUB_ISSUED" && (
                  <button onClick={() => updateStatus("REQUIREMENTS_SUBMITTED")} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                    Mark Docs Submitted
                  </button>
                )}
                {claim.status === "REQUIREMENTS_SUBMITTED" && (
                  <button onClick={() => updateStatus("SUBMITTED_TO_HO")} disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                    Submit to Head Office
                  </button>
                )}
                {claim.status === "SUBMITTED_TO_HO" && isAdmin && (
                  <button onClick={() => updateStatus("UNDER_REVIEW")} disabled={loading}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                    Start Review
                  </button>
                )}
                {claim.status === "UNDER_REVIEW" && isAdmin && (
                  <>
                    <button onClick={() => updateStatus("APPROVED")} disabled={loading || !amount}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => updateStatus("REJECTED")} disabled={loading}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                      Reject
                    </button>
                  </>
                )}
                {claim.status === "APPROVED" && (
                  <button onClick={() => updateStatus("RELEASED")} disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                    Mark as Released
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Documents</h2>

        {/* Upload */}
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Document Type</label>
            <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={uploadDoc} />
            <button onClick={() => fileRef.current?.click()} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Upload Document
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="space-y-2">
          {claim.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              {d.fileData.startsWith("data:image") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.fileData} alt={d.docType} className="w-12 h-12 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{d.docType.replace(/_/g, " ")}</p>
                <p className="text-xs text-gray-400">{d.fileName} · {new Date(d.createdAt).toLocaleDateString("en-PH")}</p>
              </div>
              <button onClick={() => deleteDoc(d.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
            </div>
          ))}
          {claim.documents.length === 0 && (
            <p className="text-sm text-gray-400">No documents uploaded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
