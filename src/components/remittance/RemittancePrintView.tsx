"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EditPaymentModal from "@/components/payments/EditPaymentModal";

interface PaymentForEdit {
  id: string;
  periodMonth: number;
  periodYear: number;
  installmentNo: number;
  paymentDate: string;
  amount: number;
  isFree: boolean;
  isSpotCash: boolean;
  paymentMethod: string;
  collectorId: string | null;
  notes: string | null;
  member: { mafNo: string; firstName: string; lastName: string };
}

interface Collector { id: string; firstName: string; lastName: string; code: string }

interface Row {
  seq: number;
  orNo: string;
  orDate: Date;
  mafNo: string;
  memberName: string;
  planAbbr: string;
  installmentNo: number;
  installmentRange: string; // e.g. "8" or "8-9"
  isComm: boolean;
  amount: number;
  comm: number;
  nonComm: number;
  others: number;
  ta: number;
  bc: number;
  net: number;
  payments: PaymentForEdit[]; // can be multiple for multi-month
}

interface Totals {
  comm: number; nonComm: number; others: number;
  ta: number; bc: number; net: number; gross: number;
}

interface RemittanceData {
  remittanceNo: string;
  remittanceDate: Date;
  periodMonth: number;
  periodYear: number;
  collectorName: string;
  collectorCode: string;
  branchName: string;
  receivedBy: string;
  collectionSupervisor: string;
  branchManagerName: string;
  totalDeposit: number | null;
  netRemittance: number;
  rows: Row[];
  totals: Totals;
}

function fmt(n: number) {
  return n === 0 ? "" : n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d: Date) {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${String(dt.getFullYear()).slice(2)}`;
}

function padRows(rows: Row[], min = 15) {
  const blanks = Array.from({ length: Math.max(0, min - rows.length) }, (_, i) => ({
    seq: rows.length + i + 1, _blank: true,
  }));
  return [...rows.map((r) => ({ ...r, _blank: false })), ...blanks] as (Row & { _blank: boolean })[];
}

export default function RemittancePrintView({
  data,
  collectors,
  remittanceId,
  isAdmin,
}: {
  data: RemittanceData;
  collectors: Collector[];
  remittanceId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editingPayment, setEditingPayment] = useState<PaymentForEdit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const allRows = padRows(data.rows);

  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleDelete() {
    if (!confirm(`Delete remittance ${data.remittanceNo}? This will also delete all linked payments. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/remittance/${remittanceId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to delete.");
        setDeleting(false);
        return;
      }
      router.push("/remittance");
    } catch {
      alert("Failed to delete.");
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Screen toolbar — hidden on print */}
      <div className="print:hidden flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Account Remittance Slip</h1>
          <p className="text-sm text-gray-500">{data.remittanceNo} · {data.branchName}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/remittance"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            ← Back
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold">
            Print ARS
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>

      {/* ── ARS Document ── */}
      <div id="ars-print"
        className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-none print:rounded-none"
        style={{ fontFamily: "Arial, sans-serif", fontSize: 11, padding: "20px 28px" }}>

        {/* Company Header */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>
            Triple J Mortuary Care Services
          </div>
          <div style={{ fontSize: 10 }}>
            2<sup>nd</sup> Floor Eden Square Building, Quezon Boulevard Kidapawan City
          </div>
          <div style={{ fontWeight: 700, fontSize: 12 }}>SEC No.: 2021050014086-02</div>
          <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>ACCOUNT REMITTANCE SLIP</div>
        </div>

        {/* Collector + Date */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <span style={{ fontWeight: 600 }}>Collector&apos;s Name: </span>
            <span style={{ borderBottom: "1px solid #000", minWidth: 180, display: "inline-block", paddingLeft: 4 }}>
              {data.collectorName}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>Date: </span>
            <span style={{ borderBottom: "1px solid #000", minWidth: 100, display: "inline-block", paddingLeft: 4 }}>
              {fmtDate(data.remittanceDate)}
            </span>
          </div>
        </div>

        {/* Main Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#f8f8f8" }}>
              {["MAF No", "Member's Name", "Inst. No.", "OR Date", "OR No.", "Plan Type", "Com", "NCom", "Others", "TA", "BC", "Net"].map((h) => (
                <th key={h} style={{
                  border: "1px solid #999", padding: "4px 5px", textAlign: "center",
                  fontWeight: 700, whiteSpace: "nowrap", fontSize: 10,
                }}>{h}</th>
              ))}
              {/* Edit column — screen only */}
              <th className="print:hidden" style={{ border: "1px solid #eee", padding: "4px 5px", width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              if (row._blank) {
                return (
                  <tr key={`blank-${i}`}>
                    {Array.from({ length: 12 }).map((_, ci) => (
                      <td key={ci} style={{ border: "1px solid #999", padding: "5px", height: 22 }}></td>
                    ))}
                    <td className="print:hidden" style={{ border: "none" }}></td>
                  </tr>
                );
              }
              const r = row as Row & { _blank: false };
              return (
                <tr key={r.seq} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", fontFamily: "monospace", fontSize: 9 }}>{r.mafNo}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px" }}>{r.memberName}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "center" }}>{r.installmentRange}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(r.orDate)}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "center", fontFamily: "monospace" }}>{r.orNo}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "center" }}>{r.planAbbr}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "right" }}>{fmt(r.comm)}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "right" }}>{fmt(r.nonComm)}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "right" }}>{fmt(r.others)}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "right" }}>{fmt(r.ta)}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "right" }}>{fmt(r.bc)}</td>
                  <td style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "right", fontWeight: 600 }}>{fmt(r.net)}</td>
                  {/* Edit button(s) — screen only */}
                  <td className="print:hidden" style={{ border: "none", padding: "2px 4px", textAlign: "center" }}>
                    {r.payments.length === 1 ? (
                      <button
                        onClick={() => setEditingPayment(r.payments[0])}
                        style={{
                          fontSize: 10, color: "#2563eb", background: "none", border: "1px solid #93c5fd",
                          borderRadius: 4, padding: "2px 6px", cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {r.payments.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setEditingPayment(p)}
                            style={{
                              fontSize: 9, color: "#2563eb", background: "none", border: "1px solid #93c5fd",
                              borderRadius: 4, padding: "1px 4px", cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            #{p.installmentNo}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr style={{ background: "#f8f8f8", fontWeight: 700 }}>
              <td colSpan={6} style={{ border: "1px solid #999", padding: "4px 5px" }}></td>
              <td style={{ border: "1px solid #999", padding: "4px 5px", textAlign: "right" }}>{fmt(data.totals.comm)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 5px", textAlign: "right" }}>{fmt(data.totals.nonComm)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 5px", textAlign: "right" }}>{fmt(data.totals.others)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 5px", textAlign: "right" }}>{fmt(data.totals.ta)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 5px", textAlign: "right" }}>{fmt(data.totals.bc)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 5px", textAlign: "right" }}>{fmt(data.totals.net)}</td>
              <td className="print:hidden" style={{ border: "none" }}></td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 20 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10 }}>Prepared by:</div>
              <div style={{ marginTop: 18, borderBottom: "1px solid #000", paddingBottom: 2, textAlign: "center", fontWeight: 600 }}>
                {data.collectorName}
              </div>
              <div style={{ textAlign: "center", fontSize: 9 }}>Account Agent</div>
            </div>
            <div>
              <div style={{ fontSize: 10 }}>Verified by:</div>
              <div style={{ marginTop: 18, borderBottom: "1px solid #000", paddingBottom: 2, textAlign: "center", fontWeight: 600 }}>
                {data.collectionSupervisor || "\u00A0"}
              </div>
              <div style={{ textAlign: "center", fontSize: 9 }}>Collection Supervisor</div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10 }}>Received by:</div>
              <div style={{ marginTop: 18, borderBottom: "1px solid #000", paddingBottom: 2, textAlign: "center", fontWeight: 600 }}>
                {data.receivedBy || "\u00A0"}
              </div>
              <div style={{ textAlign: "center", fontSize: 9 }}>Branch Staff</div>
            </div>
            <div>
              <div style={{ fontSize: 10 }}>Verified by:</div>
              <div style={{ marginTop: 18, borderBottom: "1px solid #000", paddingBottom: 2, textAlign: "center", fontWeight: 600 }}>
                {data.branchManagerName || "\u00A0"}
              </div>
              <div style={{ textAlign: "center", fontSize: 9 }}>Branch Manager</div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-start" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10 }}>Total Gross:</span>
              <span style={{ fontWeight: 700, fontSize: 11, borderBottom: "1px solid #000", minWidth: 80, textAlign: "right", paddingRight: 2 }}>
                {fmtCurrency(data.totals.gross)}
              </span>
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10 }}>NET Collection:</span>
              <span style={{ fontWeight: 700, fontSize: 11, borderBottom: "1px solid #000", minWidth: 80, textAlign: "right", paddingRight: 2 }}>
                {fmtCurrency(data.netRemittance)}
              </span>
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10 }}>Deposit:</span>
              <span style={{ fontWeight: 700, fontSize: 11, borderBottom: "1px solid #000", minWidth: 80, textAlign: "right", paddingRight: 2 }}>
                {data.totalDeposit != null ? fmtCurrency(data.totalDeposit) : "\u00A0"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Payment Modal */}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          collectors={collectors}
          onClose={() => {
            setEditingPayment(null);
            router.refresh();
          }}
        />
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ars-print, #ars-print * { visibility: visible !important; }
          #ars-print { position: fixed; top: 0; left: 0; width: 100%; padding: 12px 20px !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>
    </>
  );
}
