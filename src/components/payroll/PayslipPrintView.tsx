"use client";

import { formatCurrency } from "@/lib/utils";

interface Payslip {
  id: string; cutoffLabel: string; payDate: string;
  basicPay: number; overtime: number; holidayPay: number; allowances: number; otherEarnings: number; grossPay: number;
  daysWorked: number; daysAbsent: number; lateMins: number; lateDeduction: number;
  sss: number; philhealth: number; pagibig: number; tax: number; cashAdvance: number; absences: number;
  otherDeductions: number; totalDeductions: number; netPay: number; status: string;
  employee: { firstName: string; lastName: string; employeeNo: string; primaryPosition: string; branch: string };
}

export default function PayslipPrintView({ payslip: p, onBack }: { payslip: Payslip; onBack: () => void }) {
  const payDate = new Date(p.payDate).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <div className="print:hidden mb-4 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-purple-600 hover:underline">Back to Payslips</button>
        <button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          Print Payslip
        </button>
      </div>

      <div id="payslip-print" className="bg-white rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none max-w-2xl mx-auto"
        style={{ fontFamily: "Arial, sans-serif", padding: "24px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, borderBottom: "3px solid #1535b0", paddingBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Triple J" width={50} className="rounded-lg" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1535b0", letterSpacing: 2 }}>TRIPLE J MORTUARY CARE SERVICES CORP.</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Insurance Management System</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1535b0" }}>PAYSLIP</div>
            <div style={{ fontSize: 10, color: "#999" }}>Confidential</div>
          </div>
        </div>

        {/* Employee Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginBottom: 20 }}>
          <div>
            <span style={{ color: "#999" }}>Employee: </span>
            <strong>{p.employee.firstName} {p.employee.lastName}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "#999" }}>Employee No: </span>
            <strong>{p.employee.employeeNo}</strong>
          </div>
          <div>
            <span style={{ color: "#999" }}>Position: </span>
            <strong>{p.employee.primaryPosition}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "#999" }}>Branch: </span>
            <strong>{p.employee.branch}</strong>
          </div>
          <div>
            <span style={{ color: "#999" }}>Pay Period: </span>
            <strong>{p.cutoffLabel}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "#999" }}>Pay Date: </span>
            <strong>{payDate}</strong>
          </div>
        </div>

        {/* Attendance Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16, background: "#f8f9fa", borderRadius: 8, padding: "10px 16px", fontSize: 12 }}>
          <div>
            <span style={{ color: "#999" }}>Days Worked: </span>
            <strong>{p.daysWorked}</strong>
          </div>
          <div>
            <span style={{ color: "#999" }}>Days Absent: </span>
            <strong style={{ color: p.daysAbsent > 0 ? "#c00" : "#222" }}>{p.daysAbsent}</strong>
          </div>
          <div>
            <span style={{ color: "#999" }}>Late: </span>
            <strong style={{ color: p.lateMins > 0 ? "#c00" : "#222" }}>
              {p.lateMins > 0 ? `${Math.floor(p.lateMins / 60)}h ${p.lateMins % 60}m` : "None"}
            </strong>
          </div>
        </div>

        {/* Two columns: Earnings + Deductions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
          {/* Earnings */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#1535b0", borderBottom: "2px solid #1535b0", paddingBottom: 4, marginBottom: 8 }}>
              EARNINGS
            </div>
            <table style={{ width: "100%", fontSize: 12 }}>
              <tbody>
                <Row label="Basic Pay" amount={p.basicPay} />
                {p.allowances > 0 && <Row label="Allowances" amount={p.allowances} />}
                {p.overtime > 0 && <Row label="Overtime" amount={p.overtime} />}
                {p.holidayPay > 0 && <Row label="Holiday Pay" amount={p.holidayPay} />}
                {p.otherEarnings > 0 && <Row label="Other Earnings" amount={p.otherEarnings} />}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid #ddd" }}>
                  <td style={{ fontWeight: 700, paddingTop: 6 }}>Gross Pay</td>
                  <td style={{ fontWeight: 700, textAlign: "right", paddingTop: 6, color: "#1535b0" }}>{formatCurrency(p.grossPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#c00", borderBottom: "2px solid #c00", paddingBottom: 4, marginBottom: 8 }}>
              DEDUCTIONS
            </div>
            <table style={{ width: "100%", fontSize: 12 }}>
              <tbody>
                {p.sss > 0 && <Row label="SSS" amount={p.sss} red />}
                {p.philhealth > 0 && <Row label="PhilHealth" amount={p.philhealth} red />}
                {p.pagibig > 0 && <Row label="Pag-IBIG" amount={p.pagibig} red />}
                {p.tax > 0 && <Row label="Withholding Tax" amount={p.tax} red />}
                {p.cashAdvance > 0 && <Row label="Cash Advance / Loan" amount={p.cashAdvance} red />}
                {p.lateDeduction > 0 && <Row label="Late Deduction" amount={p.lateDeduction} red />}
                {p.absences > 0 && <Row label="Absences" amount={p.absences} red />}
                {p.otherDeductions > 0 && <Row label="Other Deductions" amount={p.otherDeductions} red />}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid #ddd" }}>
                  <td style={{ fontWeight: 700, paddingTop: 6 }}>Total Deductions</td>
                  <td style={{ fontWeight: 700, textAlign: "right", paddingTop: 6, color: "#c00" }}>{formatCurrency(p.totalDeductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Net Pay */}
        <div style={{
          background: "linear-gradient(90deg, #1535b0 0%, #0e2580 100%)",
          borderRadius: 12, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 24,
        }}>
          <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600, fontSize: 14 }}>NET PAY</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>{formatCurrency(p.netPay)}</span>
        </div>

        {/* Signatures */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, fontSize: 10, marginTop: 32 }}>
          <div>
            <div style={{ borderBottom: "1px solid #000", height: 30 }}></div>
            <div style={{ marginTop: 4, color: "#666" }}>Prepared by (HR)</div>
          </div>
          <div>
            <div style={{ borderBottom: "1px solid #000", height: 30 }}></div>
            <div style={{ marginTop: 4, color: "#666" }}>Approved by</div>
          </div>
          <div>
            <div style={{ borderBottom: "1px solid #000", height: 30 }}></div>
            <div style={{ marginTop: 4, color: "#666" }}>Received by (Employee)</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#bbb", marginTop: 24, borderTop: "1px solid #eee", paddingTop: 8 }}>
          Triple J Mortuary Care Services Corp. — This is a computer-generated payslip.
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payslip-print, #payslip-print * { visibility: visible !important; }
          #payslip-print { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: portrait; margin: 10mm; }
        }
      `}</style>
    </>
  );
}

function Row({ label, amount, red }: { label: string; amount: number; red?: boolean }) {
  return (
    <tr>
      <td style={{ padding: "3px 0", color: "#444" }}>{label}</td>
      <td style={{ padding: "3px 0", textAlign: "right", color: red ? "#c00" : "#222" }}>{formatCurrency(amount)}</td>
    </tr>
  );
}
