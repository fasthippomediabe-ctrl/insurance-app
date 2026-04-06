"use client";

import { formatCurrency } from "@/lib/utils";

interface ClaimData {
  claimNo: string; deceasedName: string; deceasedType: string; dateOfDeath: string;
  claimantName: string; claimantRelationship: string; claimantAddress: string | null;
  planCategory: string; approvedAmount: number | null; releasedAmount: number | null;
  dateReleased: string | null;
  member: { mafNo: string; firstName: string; lastName: string; branch: string };
}

export default function ClaimCertificate({ claim, onBack }: { claim: ClaimData; onBack: () => void }) {
  const amount = claim.releasedAmount ?? claim.approvedAmount ?? 0;
  const dateReleased = claim.dateReleased
    ? new Date(claim.dateReleased).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  const dateOfDeath = new Date(claim.dateOfDeath).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

  // Amount in words (simple)
  function amountInWords(n: number): string {
    if (n === 0) return "Zero";
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const scales = ["", "Thousand", "Million"];
    const whole = Math.floor(n);
    const centavos = Math.round((n - whole) * 100);
    let words = "";
    let scaleIdx = 0;
    let num = whole;
    while (num > 0) {
      const chunk = num % 1000;
      if (chunk > 0) {
        let chunkWords = "";
        const h = Math.floor(chunk / 100);
        const t = chunk % 100;
        if (h > 0) chunkWords += ones[h] + " Hundred ";
        if (t >= 20) { chunkWords += tens[Math.floor(t / 10)] + " " + ones[t % 10]; }
        else if (t > 0) { chunkWords += ones[t]; }
        words = chunkWords.trim() + (scales[scaleIdx] ? " " + scales[scaleIdx] : "") + " " + words;
      }
      num = Math.floor(num / 1000);
      scaleIdx++;
    }
    words = words.trim();
    if (centavos > 0) words += ` and ${centavos}/100`;
    return words + " Pesos Only";
  }

  return (
    <>
      <div className="print:hidden mb-4 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-purple-600 hover:underline">Back to Claim</button>
        <button onClick={() => window.print()} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          Print Certificate
        </button>
      </div>

      <div id="cert-print" className="bg-white rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none max-w-2xl mx-auto"
        style={{ fontFamily: "Georgia, serif", padding: "40px 48px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Triple J" width={50} className="rounded-lg" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#1535b0", letterSpacing: 3 }}>
            TRIPLE J MORTUARY CARE SERVICES CORP.
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
            {claim.member.branch}
          </div>
          <div style={{ marginTop: 16, borderBottom: "3px double #1535b0", paddingBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#1535b0", letterSpacing: 4 }}>
              CERTIFICATE OF CLAIM RELEASE
            </span>
          </div>
        </div>

        {/* Claim Reference */}
        <div style={{ textAlign: "right", fontSize: 11, color: "#888", marginBottom: 20 }}>
          Claim No: <strong>{claim.claimNo}</strong> &nbsp;|&nbsp; Date: <strong>{dateReleased}</strong>
        </div>

        {/* Body */}
        <div style={{ fontSize: 14, lineHeight: 2, textAlign: "justify", marginBottom: 32 }}>
          <p>This is to certify that <strong style={{ textDecoration: "underline" }}>{claim.claimantName}</strong>
          {claim.claimantRelationship && <>, <em>{claim.claimantRelationship}</em> of the deceased</>}
          {claim.claimantAddress && <>, residing at <em>{claim.claimantAddress}</em></>}
          , has received the insurance claim benefit amounting to:</p>

          <div style={{
            textAlign: "center", margin: "20px 0", padding: "16px 24px",
            background: "linear-gradient(90deg, #1535b0 0%, #0e2580 100%)",
            borderRadius: 12, color: "#fff",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>{formatCurrency(amount)}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: "rgba(255,255,255,0.7)" }}>({amountInWords(amount)})</div>
          </div>

          <p>for the death of <strong style={{ textDecoration: "underline" }}>{claim.deceasedName}</strong>
          {" "}({claim.deceasedType === "MEMBER" ? "Plan Holder" : "Beneficiary"}),
          who passed away on <strong>{dateOfDeath}</strong>,
          under plan <strong>{claim.planCategory}</strong>,
          MAF No. <strong>{claim.member.mafNo}</strong>,
          account holder <strong>{claim.member.firstName} {claim.member.lastName}</strong>.</p>

          <p style={{ marginTop: 16 }}>
            This certificate is issued upon request for whatever legal purpose it may serve.
          </p>
        </div>

        {/* Signatures */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 48, fontSize: 11 }}>
          <div>
            <div style={{ borderBottom: "1px solid #000", height: 40 }}></div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>Claimant&apos;s Signature</div>
            <div style={{ color: "#888" }}>{claim.claimantName}</div>
          </div>
          <div>
            <div style={{ borderBottom: "1px solid #000", height: 40 }}></div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>Authorized Representative</div>
            <div style={{ color: "#888" }}>Triple J Mortuary Care Services Corp.</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#bbb", marginTop: 40, borderTop: "1px solid #eee", paddingTop: 12 }}>
          Triple J Mortuary Care Services Corp. — This is a computer-generated certificate. Valid without erasure or alteration.
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cert-print, #cert-print * { visibility: visible !important; }
          #cert-print { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: portrait; margin: 15mm; }
        }
      `}</style>
    </>
  );
}
