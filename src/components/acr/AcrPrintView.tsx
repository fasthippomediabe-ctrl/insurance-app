"use client";

import type { AcrRow } from "@/app/(dashboard)/acr/page";

const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

function fmt(n: number) {
  return n > 0 ? n.toLocaleString("en-PH") : "0";
}

function fmtPeso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AcrPrintView({
  commRows, nonCommRows, collectorName, branchName, month, year, periodLabel,
}: {
  commRows: AcrRow[];
  nonCommRows: AcrRow[];
  collectorName: string;
  branchName: string;
  month: number;
  year: number;
  periodLabel: string;
}) {
  const printDate = new Date().toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <div id="acr-print">
        {/* COMM section */}
        {commRows.length > 0 && (
          <AcrSection
            rows={commRows}
            category="Comm"
            collectorName={collectorName}
            branchName={branchName}
            month={month}
            year={year}
            printDate={printDate}
          />
        )}

        {/* NONCOMM section — page break before */}
        {nonCommRows.length > 0 && (
          <div style={{ pageBreakBefore: commRows.length > 0 ? "always" : undefined }}>
            <AcrSection
              rows={nonCommRows}
              category="NComm"
              collectorName={collectorName}
              branchName={branchName}
              month={month}
              year={year}
              printDate={printDate}
            />
          </div>
        )}

        {commRows.length === 0 && nonCommRows.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No accounts found for this collector and period.
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #acr-print, #acr-print * { visibility: visible !important; }
          #acr-print { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: landscape; margin: 6mm; }
        }
      `}</style>
    </>
  );
}

function AcrSection({ rows, category, collectorName, branchName, month, year, printDate }: {
  rows: AcrRow[];
  category: "Comm" | "NComm";
  collectorName: string;
  branchName: string;
  month: number;
  year: number;
  printDate: string;
}) {
  // Aging counts
  const agingCounts = { 30: 0, 60: 0, 90: 0, 0: 0 };
  const agingComm = { 30: 0, 60: 0, 90: 0, 0: 0 };
  const agingNComm = { 30: 0, 60: 0, 90: 0, 0: 0 };

  for (const r of rows) {
    agingCounts[r.aging]++;
    agingComm[r.aging] += r.comAmount;
    agingNComm[r.aging] += r.ncomAmount;
  }

  const totalAccounts = rows.length;
  const totalComm = rows.reduce((s, r) => s + r.comAmount, 0);
  const totalNComm = rows.reduce((s, r) => s + r.ncomAmount, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  // DAP = Daily Account Performance: overdue accounts (aging > 0)
  // Quota: COMM = 60%, NONCOMM = 70%
  const overdueCount = rows.filter((r) => r.aging > 0).length;
  const dapQuotaPct = category === "Comm" ? 60 : 70;
  const dapQuota = Math.ceil(overdueCount * (dapQuotaPct / 100));

  // TCP = Total Collection Performance: total due amount of overdue
  // Quota: COMM = 65%, NONCOMM = 75%
  const overdueDue = rows.filter((r) => r.aging > 0).reduce((s, r) => s + r.comAmount + r.ncomAmount, 0);
  const tcpQuotaPct = category === "Comm" ? 65 : 75;
  const tcpQuota = overdueDue * (tcpQuotaPct / 100);

  const S: React.CSSProperties = { border: "1px solid #999", padding: "2px 4px", fontSize: 9, verticalAlign: "top" };
  const SH: React.CSSProperties = { ...S, background: "#e8e8e8", fontWeight: 700, textAlign: "center", whiteSpace: "nowrap" };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-none print:rounded-none mb-6"
      style={{ fontFamily: "Arial, sans-serif", padding: "12px 16px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>TRIPLE J MORTUARY CARE SERVICES CORP.</div>
        <div style={{ fontWeight: 700, fontSize: 11 }}>{branchName.toUpperCase()}</div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Account Collection Report</div>
      </div>

      {/* Sub-header row */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <span>Month: <strong>{MONTHS[month - 1]} {year}</strong></span>
        <span><strong>{collectorName.toUpperCase()}</strong></span>
        <span><strong>{branchName.toUpperCase()}</strong></span>
        <span>Category: <strong>{category}</strong></span>
        <span>Print Date: <strong>{printDate}</strong></span>
      </div>

      {/* Main table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={SH}></th>
            <th style={SH}>MAF</th>
            <th style={SH}>FIRST NAME</th>
            <th style={SH}>MIDDLE</th>
            <th style={SH}>LAST NAME</th>
            <th style={SH}>EFFECT. DATE</th>
            <th style={SH}>DUE DATE</th>
            <th style={SH}>CODE</th>
            <th style={SH}>COM</th>
            <th style={SH}>NCOMM</th>
            <th style={SH}>INST.</th>
            <th style={SH}>AGING</th>
            <th style={SH}>BALANCE</th>
            <th style={{ ...SH, minWidth: 120 }}>ADDRESS</th>
            <th style={SH}>CONTACT NUMBER</th>
            <th style={SH}>SALES AGENT</th>
            <th style={{ ...SH, minWidth: 60 }}>PAYMENT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: r.aging === 90 ? "#fff0f0" : i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <td style={{ ...S, textAlign: "center", color: "#999" }}>{i + 1}</td>
              <td style={{ ...S, fontFamily: "monospace" }}>{r.mafNo}</td>
              <td style={S}>{r.firstName}</td>
              <td style={S}>{r.middleName}</td>
              <td style={{ ...S, fontWeight: 600 }}>{r.lastName}</td>
              <td style={{ ...S, textAlign: "center", whiteSpace: "nowrap" }}>{r.effectivityDate}</td>
              <td style={{ ...S, textAlign: "center", whiteSpace: "nowrap" }}>{r.dueDate}</td>
              <td style={{ ...S, textAlign: "center", fontFamily: "monospace" }}>{r.mopCode}</td>
              <td style={{ ...S, textAlign: "right" }}>{r.comAmount > 0 ? fmt(r.comAmount) : ""}</td>
              <td style={{ ...S, textAlign: "right" }}>{r.ncomAmount > 0 ? fmt(r.ncomAmount) : ""}</td>
              <td style={{ ...S, textAlign: "center" }}>{r.installmentNo}</td>
              <td style={{ ...S, textAlign: "center", fontWeight: r.aging >= 90 ? 700 : 400, color: r.aging >= 90 ? "#c00" : r.aging >= 60 ? "#c60" : undefined }}>
                {r.aging}
              </td>
              <td style={{ ...S, textAlign: "right" }}>{fmt(r.balance)}</td>
              <td style={{ ...S, fontSize: 8, maxWidth: 150 }}>{r.address}</td>
              <td style={{ ...S, textAlign: "center", fontSize: 8 }}>{r.contactNumber}</td>
              <td style={{ ...S, fontSize: 8 }}>{r.agentName.toUpperCase()}</td>
              <td style={S}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, gap: 16, fontSize: 9 }}>
        {/* Left: Aging summary + DAP/TCP */}
        <div style={{ flex: "0 0 auto" }}>
          <table style={{ borderCollapse: "collapse", marginBottom: 6 }}>
            <thead>
              <tr>
                <th style={{ ...S, background: "#eee" }}></th>
                <th style={{ ...S, background: "#eee" }}>Account</th>
                <th style={{ ...S, background: "#eee" }}>QComm</th>
                <th style={{ ...S, background: "#eee" }}>QNCmm</th>
              </tr>
            </thead>
            <tbody>
              {([30, 60, 90, 0] as const).map((a) => (
                <tr key={a}>
                  <td style={{ ...S, fontWeight: 600 }}>{a}</td>
                  <td style={{ ...S, textAlign: "right" }}>{agingCounts[a]}</td>
                  <td style={{ ...S, textAlign: "right" }}>{agingComm[a] > 0 ? fmt(agingComm[a]) : ""}</td>
                  <td style={{ ...S, textAlign: "right" }}>{agingNComm[a] > 0 ? fmt(agingNComm[a]) : ""}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td style={S}>Total</td>
                <td style={{ ...S, textAlign: "right" }}>{totalAccounts}</td>
                <td style={{ ...S, textAlign: "right" }}>{totalComm > 0 ? fmt(totalComm) : "0"}</td>
                <td style={{ ...S, textAlign: "right" }}>{totalNComm > 0 ? fmt(totalNComm) : "0"}</td>
              </tr>
            </tbody>
          </table>

          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...S, background: "#eee" }}></th>
                <th style={{ ...S, background: "#eee" }}>TOTAL</th>
                <th style={{ ...S, background: "#eee" }}>QUOTA ({category === "Comm" ? "COMM" : "NCOMM"})</th>
                <th style={{ ...S, background: "#eee" }}>COLLECTED</th>
                <th style={{ ...S, background: "#eee" }}>%</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...S, fontWeight: 600 }}>DAP</td>
                <td style={{ ...S, textAlign: "right" }}>{overdueCount} accts</td>
                <td style={{ ...S, textAlign: "right" }}>{dapQuota} ({dapQuotaPct}%)</td>
                <td style={{ ...S, textAlign: "right", minWidth: 60 }}></td>
                <td style={{ ...S, textAlign: "right", minWidth: 40 }}></td>
              </tr>
              <tr>
                <td style={{ ...S, fontWeight: 600 }}>TCP</td>
                <td style={{ ...S, textAlign: "right" }}>{fmtPeso(overdueDue)}</td>
                <td style={{ ...S, textAlign: "right" }}>{fmtPeso(tcpQuota)} ({tcpQuotaPct}%)</td>
                <td style={{ ...S, textAlign: "right", minWidth: 60 }}></td>
                <td style={{ ...S, textAlign: "right", minWidth: 40 }}></td>
              </tr>
            </tbody>
          </table>

        </div>

        {/* Middle: Gross/Net/Production */}
        <div style={{ flex: "0 0 auto" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Gross Comm:", "Php"],
                ["Gross Rem.:", "Php"],
                ["Net Rem.:", "Php"],
              ].map(([label, val], i) => (
                <tr key={i}>
                  <td style={{ padding: "2px 8px 2px 0", fontWeight: 600 }}>{label}</td>
                  <td style={{ padding: "2px 4px", minWidth: 80 }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Total Production / OR / Balance */}
        <div style={{ flex: "0 0 auto" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr><td style={{ padding: "2px 8px 2px 0" }}>Total Production:</td><td style={{ padding: "2px 4px" }}>Php</td></tr>
              <tr><td style={{ padding: "2px 8px 2px 0" }}>O.R. Amount:</td><td style={{ padding: "2px 4px" }}>Php</td></tr>
              <tr><td style={{ padding: "2px 8px 2px 0" }}>Balance:</td><td style={{ padding: "2px 4px", fontWeight: 700 }}>{fmt(totalBalance)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 30, fontSize: 9 }}>
        <div style={{ flex: 1 }}>
          <div>Prepared by:</div>
          <div style={{ borderBottom: "1px solid #000", marginTop: 24, marginBottom: 2 }}></div>
          <div>Cashier</div>
        </div>
        <div style={{ flex: 1 }}>
          <div>Checked by:</div>
          <div style={{ borderBottom: "1px solid #000", marginTop: 24, marginBottom: 2 }}></div>
          <div>Collection Supervisor</div>
        </div>
        <div style={{ flex: 1 }}>
          <div>Verified by:</div>
          <div style={{ borderBottom: "1px solid #000", marginTop: 24, marginBottom: 2 }}></div>
          <div>Branch Manager</div>
        </div>
      </div>

    </div>
  );
}

