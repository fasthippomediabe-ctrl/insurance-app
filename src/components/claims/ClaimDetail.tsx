"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import ClaimCertificate from "./ClaimCertificate";

interface Doc { id: string; docType: string; fileName: string; fileData: string; createdAt: string }
interface StatusLog { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }

interface ClaimData {
  id: string; claimNo: string; memberId: string; branchId: string;
  deceasedType: string; deceasedName: string; dateOfDeath: string; causeOfDeath: string | null;
  claimantName: string; claimantRelationship: string; claimantContact: string | null; claimantAddress: string | null;
  planCategory: string; approvedAmount: number | null; releasedAmount: number | null;
  totalPlanAmount: number; dateReleased: string | null; status: string; filedDate: string;
  submittedToHO: string | null; approvedDate: string | null;
  notes: string | null; rejectionReason: string | null;
  courierTracking: string | null; additionalDocsNote: string | null;
  documents: Doc[];
  statusLogs: StatusLog[];
  member: { mafNo: string; firstName: string; lastName: string; planCategory: string; branch: string };
}

const STATUS_FLOW = [
  { key: "STUB_ISSUED", label: "Stub Issued", icon: "1" },
  { key: "DOCS_RECEIVED_BRANCH", label: "Docs Received at Branch", icon: "2" },
  { key: "DOCS_IN_TRANSIT", label: "Docs in Transit", icon: "3" },
  { key: "DOCS_RECEIVED_HO", label: "Received at HO", icon: "4" },
  { key: "UNDER_REVIEW", label: "Under Review", icon: "5" },
  { key: "IN_PROGRESS", label: "Processing", icon: "6" },
  { key: "APPROVED", label: "Approved", icon: "7" },
  { key: "CHEQUE_PREPARING", label: "Preparing Cheque", icon: "8" },
  { key: "CHEQUE_IN_TRANSIT", label: "Cheque in Transit", icon: "9" },
  { key: "CHEQUE_RECEIVED_BRANCH", label: "Cheque at Branch", icon: "10" },
  { key: "RELEASED", label: "Released", icon: "11" },
];

const STATUS_LABELS: Record<string, string> = {};
STATUS_FLOW.forEach((s) => { STATUS_LABELS[s.key] = s.label; });
STATUS_LABELS["ADDITIONAL_DOCS_NEEDED"] = "Additional Docs Needed";
STATUS_LABELS["REJECTED"] = "Rejected";

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
  const [statusNote, setStatusNote] = useState("");
  const [courierTracking, setCourierTracking] = useState(claim.courierTracking ?? "");
  const [additionalDocsNote, setAdditionalDocsNote] = useState(claim.additionalDocsNote ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === claim.status);

  async function updateStatus(newStatus: string) {
    setLoading(true); setMsg("");
    try {
      const body: any = { id: claim.id, status: newStatus, statusNote: statusNote || undefined };
      if (newStatus === "APPROVED" && amount) body.approvedAmount = parseFloat(amount);
      if (newStatus === "RELEASED" && amount) body.releasedAmount = parseFloat(amount);
      if (newStatus === "DOCS_IN_TRANSIT") body.courierTracking = courierTracking;
      if (newStatus === "ADDITIONAL_DOCS_NEEDED") body.additionalDocsNote = additionalDocsNote;
      if (newStatus === "REJECTED") body.rejectionReason = rejectionReason;
      const res = await fetch("/api/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Status updated!");
      setStatusNote("");
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
          method: "POST", headers: { "Content-Type": "application/json" },
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

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const fmtDateTime = (d: string) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  // Determine next possible actions based on current status
  const nextActions: { status: string; label: string; color: string; adminOnly?: boolean; needsInput?: string }[] = [];
  switch (claim.status) {
    case "STUB_ISSUED":
      nextActions.push({ status: "DOCS_RECEIVED_BRANCH", label: "Mark Docs Received at Branch", color: "bg-blue-600 hover:bg-blue-700" });
      break;
    case "DOCS_RECEIVED_BRANCH":
      nextActions.push({ status: "DOCS_IN_TRANSIT", label: "Ship to Head Office", color: "bg-indigo-600 hover:bg-indigo-700", needsInput: "courier" });
      break;
    case "DOCS_IN_TRANSIT":
      nextActions.push({ status: "DOCS_RECEIVED_HO", label: "Confirm Received at HO", color: "bg-purple-600 hover:bg-purple-700", adminOnly: true });
      break;
    case "DOCS_RECEIVED_HO":
      nextActions.push({ status: "UNDER_REVIEW", label: "Start Review", color: "bg-yellow-500 hover:bg-yellow-600", adminOnly: true });
      break;
    case "UNDER_REVIEW":
      nextActions.push({ status: "ADDITIONAL_DOCS_NEEDED", label: "Request Additional Docs", color: "bg-orange-500 hover:bg-orange-600", adminOnly: true, needsInput: "addDocs" });
      nextActions.push({ status: "IN_PROGRESS", label: "Docs Complete, Process", color: "bg-blue-600 hover:bg-blue-700", adminOnly: true });
      break;
    case "ADDITIONAL_DOCS_NEEDED":
      nextActions.push({ status: "UNDER_REVIEW", label: "Additional Docs Received, Resume Review", color: "bg-yellow-500 hover:bg-yellow-600" });
      break;
    case "IN_PROGRESS":
      nextActions.push({ status: "APPROVED", label: "Approve Claim", color: "bg-green-600 hover:bg-green-700", adminOnly: true });
      nextActions.push({ status: "REJECTED", label: "Reject Claim", color: "bg-red-600 hover:bg-red-700", adminOnly: true, needsInput: "reject" });
      break;
    case "APPROVED":
      nextActions.push({ status: "CHEQUE_PREPARING", label: "Start Preparing Cheque", color: "bg-blue-600 hover:bg-blue-700", adminOnly: true });
      break;
    case "CHEQUE_PREPARING":
      nextActions.push({ status: "CHEQUE_IN_TRANSIT", label: "Cheque Sent to Branch", color: "bg-indigo-600 hover:bg-indigo-700", adminOnly: true, needsInput: "courier" });
      break;
    case "CHEQUE_IN_TRANSIT":
      nextActions.push({ status: "CHEQUE_RECEIVED_BRANCH", label: "Cheque Received at Branch", color: "bg-purple-600 hover:bg-purple-700" });
      break;
    case "CHEQUE_RECEIVED_BRANCH":
      nextActions.push({ status: "RELEASED", label: "Release Cheque to Claimant", color: "bg-emerald-600 hover:bg-emerald-700" });
      break;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claim {claim.claimNo}</h1>
          <p className="text-gray-500 text-sm">{claim.member.mafNo} — {claim.member.firstName} {claim.member.lastName}</p>
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <h2 className="font-semibold text-gray-800 mb-4">Claim Progress</h2>
        <div className="flex items-center gap-0.5 min-w-max">
          {STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const active = s.key === claim.status;
            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg text-center min-w-[60px] ${
                  active ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-700" : "bg-gray-50 text-gray-300"
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    active ? "bg-white text-blue-600" : done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                  }`}>{done && !active ? "✓" : s.icon}</span>
                  <span className="text-[9px] font-medium leading-tight">{s.label}</span>
                </div>
                {i < STATUS_FLOW.length - 1 && <div className={`w-3 h-0.5 flex-shrink-0 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
        {claim.status === "REJECTED" && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            <strong>REJECTED</strong>{claim.rejectionReason && <> — {claim.rejectionReason}</>}
          </div>
        )}
        {claim.status === "ADDITIONAL_DOCS_NEEDED" && (
          <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm text-orange-700">
            <strong>Additional Documents Required:</strong> {claim.additionalDocsNote || "Please contact the branch for details."}
          </div>
        )}
        {claim.courierTracking && (
          <p className="mt-2 text-xs text-gray-500">Courier Tracking: <strong>{claim.courierTracking}</strong></p>
        )}
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
            <div><p className="text-xs text-gray-400">Filed</p><p className="font-bold">{fmtDate(claim.filedDate)}</p></div>
            <div><p className="text-xs text-gray-400">Branch</p><p className="font-bold">{claim.member.branch}</p></div>
          </div>
        </div>

        {/* Actions & Amount */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3">Claim Amount</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Approved Amount</label>
              <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount"
                disabled={claim.status === "RELEASED"} />
            </div>
            {claim.approvedAmount && <p className="mt-2 text-sm">Approved: <strong className="text-green-700">{formatCurrency(claim.approvedAmount)}</strong></p>}
            {claim.releasedAmount && <p className="text-sm">Released: <strong className="text-green-700">{formatCurrency(claim.releasedAmount)}</strong> on {fmtDate(claim.dateReleased)}</p>}
          </div>

          {/* Actions */}
          {nextActions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Next Step</h2>

              {/* Optional note for status update */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Note (optional)</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)} placeholder="Add a note for this update" />
              </div>

              {/* Conditional inputs */}
              {nextActions.some((a) => a.needsInput === "courier") && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Courier Tracking No.</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={courierTracking}
                    onChange={(e) => setCourierTracking(e.target.value)} placeholder="e.g. JRS-12345678" />
                </div>
              )}
              {nextActions.some((a) => a.needsInput === "addDocs") && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">What documents are needed?</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                    value={additionalDocsNote} onChange={(e) => setAdditionalDocsNote(e.target.value)}
                    placeholder="e.g. Missing marriage certificate, need certified true copy of death certificate" />
                </div>
              )}
              {nextActions.some((a) => a.needsInput === "reject") && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rejection Reason</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                    value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejecting this claim" />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {nextActions.map((a) => {
                  if (a.adminOnly && !isAdmin) return null;
                  return (
                    <button key={a.status} onClick={() => updateStatus(a.status)} disabled={loading}
                      className={`${a.color} text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50`}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Timeline */}
          {claim.statusLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Status History</h2>
              <div className="space-y-3">
                {claim.statusLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-gray-800">
                        <strong>{STATUS_LABELS[log.toStatus] ?? log.toStatus}</strong>
                        {log.fromStatus && <span className="text-gray-400"> from {STATUS_LABELS[log.fromStatus] ?? log.fromStatus}</span>}
                      </p>
                      {log.note && <p className="text-xs text-gray-500">{log.note}</p>}
                      <p className="text-xs text-gray-400">{fmtDateTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Documents</h2>
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
          {claim.documents.length === 0 && <p className="text-sm text-gray-400">No documents uploaded yet.</p>}
        </div>
      </div>
    </div>
  );
}
