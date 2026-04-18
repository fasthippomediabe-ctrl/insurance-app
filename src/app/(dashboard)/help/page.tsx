import { auth } from "@/lib/auth";

export default async function HelpPage() {
  const session = await auth();
  const user = session!.user as any;
  const role = user.role;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How to Use the System</h1>
        <p className="text-gray-500 text-sm mt-1">Step-by-step instructions and best practices for Triple J staff.</p>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
        <h2 className="text-sm font-bold text-amber-900 mb-2">⚠ IMPORTANT — Data Migration Notice</h2>
        <p className="text-sm text-amber-800 leading-relaxed">
          We migrated from the old spreadsheet system to this new database. The system is still being updated.
          <strong> Branch staff must update member payment records</strong> based on the old spreadsheet
          until we reach 100% parity. Always cross-check with the old SOA before telling a member their balance is final.
        </p>
        <ul className="text-xs text-amber-700 list-disc list-inside mt-3 space-y-1">
          <li>Quarterly, semi-annual, and annual payments may have wrong amounts — edit them in the Payment Ledger (click the red/green cells on a member&apos;s page).</li>
          <li>Some FREE months may not reflect correctly — verify and fix manually.</li>
          <li>If a member reports a discrepancy, check the old spreadsheet first, then update here.</li>
        </ul>
      </div>

      {/* Role-specific quick guide */}
      {(role === "BRANCH_STAFF" || role === "COLLECTION_SUPERVISOR") && (
        <Section title="Branch Staff Daily Tasks">
          <Step n={1} title="Record a Remittance">
            Go to <Tag>Remittance</Tag> → <Tag>+ New Remittance</Tag>. Pick the collector, enter each member&apos;s payment
            (MAF, OR No., amount). The system auto-computes BC, TA, and net. Click Save.
          </Step>
          <Step n={2} title="Enroll a New Member">
            Go to <Tag>Members</Tag> → <Tag>+ New Member</Tag>. Fill in the MAF number (system checks for duplicates),
            plan, and MOP. Complete beneficiaries. Choose <strong>Spot Cash</strong> for upfront payment or
            <strong>Spot Service</strong> for non-member mortuary service.
          </Step>
          <Step n={3} title="Fix or Add a Payment">
            Open the member&apos;s page → scroll to <Tag>Payment Ledger</Tag>. Click any month cell:
            <ul className="list-disc list-inside ml-4 mt-1 text-xs">
              <li><strong>Green (paid)</strong> — click to edit the amount</li>
              <li><strong>Red (unpaid)</strong> — click to add a payment for that month</li>
            </ul>
          </Step>
          <Step n={4} title="File a Claim">
            Go to <Tag>Claims</Tag> → <Tag>+ New Claim</Tag>. Select the member, deceased type (member or beneficiary),
            and death type (natural/accident/suicide). The system auto-checks eligibility based on contestability rules.
          </Step>
          <Step n={5} title="Generate ACR">
            Go to <Tag>ACR</Tag>. Select a collector and the month. Click Print ACR. The system generates COMM and
            NONCOMM pages ready to give to the collector.
          </Step>
          <Step n={6} title="Process a Reinstatement">
            Lapsed members appear with a red banner on their profile. Click <Tag>Process Reinstatement</Tag>, choose
            <strong>Redating</strong> (pay 2 months + ₱100) or <strong>Updating</strong> (pay all missed + ₱100).
            The reinstating agent becomes the new agent of record.
          </Step>
          <Step n={7} title="Request Payment/Expense/Liability from HO">
            Go to <Tag>Branch Requests</Tag> → <Tag>+ New Request</Tag>. Fill in the amount, description, attach
            a receipt photo if available. HO will approve and mark as released when funds are sent.
          </Step>
        </Section>
      )}

      {(role === "ADMIN" || role === "ACCOUNTING") && (
        <Section title="Admin / Accounting Daily Tasks">
          <Step n={1} title="Approve Branch Requests">
            <Tag>Branch Requests</Tag> → click any pending request → Approve/Reject. Mark as <strong>Released</strong>
            once the funds are actually transferred.
          </Step>
          <Step n={2} title="Review Edit Requests">
            <Tag>Edit Requests</Tag> (admin only) shows pending member/payment edits submitted by branch staff.
            Review the changes and approve/reject.
          </Step>
          <Step n={3} title="Review Claims">
            <Tag>Claims</Tag> → when a claim is <strong>Submitted to HO</strong>, start the review. You can request
            additional documents, approve with amount, or reject with reason. Track cheque preparation &amp;
            transit through the 13-step workflow.
          </Step>
          <Step n={4} title="Record Expenses">
            <Tag>Accounting</Tag> → <Tag>+ Record Expense</Tag>. Assign to a category and branch. Attach receipt
            photo. Use <Tag>P&amp;L Report</Tag> for income vs expense by month/branch.
          </Step>
          <Step n={5} title="Bulk Data Imports">
            <Tag>Import Records</Tag> (admin only) handles CSV uploads for members and payments. Make sure to
            import members first, then payments. The system auto-creates agents/collectors if not found.
          </Step>
        </Section>
      )}

      {role === "HR" && (
        <Section title="HR Tasks">
          <Step n={1} title="Setup Salary Profile">
            <Tag>Payroll</Tag> → <Tag>Salary Profiles</Tag> → pick an employee → configure basic salary, allowances,
            government contributions, pay type (Monthly/Daily), pay schedule, late rules.
          </Step>
          <Step n={2} title="Import Biometric Attendance">
            <Tag>Payroll</Tag> → <Tag>Attendance</Tag>. Upload the biometric CSV. Set expected time in (e.g. 08:00)
            and hours/day. The system auto-computes late minutes and hours worked per day.
          </Step>
          <Step n={3} title="Generate Payslips">
            <Tag>Payroll</Tag> → <Tag>Generate Payslips</Tag>. Pick month, year, and cutoff (1st half or 2nd half).
            The system auto-pulls attendance and creates payslips with all deductions (SSS, PhilHealth, Pag-IBIG, tax,
            loans, absences, late).
          </Step>
          <Step n={4} title="Record Cash Advances / Loans">
            <Tag>Payroll</Tag> → <Tag>Loans</Tag> → <Tag>+ New Loan</Tag>. Set total amount and per-cutoff deduction.
            The system auto-deducts from payslips until fully paid.
          </Step>
          <Step n={5} title="Add / Edit Employees">
            <Tag>Employees</Tag> tab. HR has edit access across all branches. Use <Tag>Promote</Tag>/<Tag>Demote</Tag>
            buttons for position changes (adds a record to promotion history).
          </Step>
        </Section>
      )}

      {role === "COLLECTION_HEAD" && (
        <Section title="Collection Head Tasks">
          <Step n={1} title="Monitor All Branches">
            You have view access to all branch Members, Payments, Collectors, ACR, and Incentives. Use the dashboard
            to compare branch performance (NE, collections, lapsed members).
          </Step>
          <Step n={2} title="Review Collector Performance">
            <Tag>Dashboard</Tag> shows each collector&apos;s DAP/TCP percentages for the current month. Green = PASS,
            red = failing. Use <Tag>ACR</Tag> to drill into specific collectors and periods.
          </Step>
          <Step n={3} title="Review Incentives">
            <Tag>Incentives</Tag> by branch shows per-employee breakdown. <Tag>RM Incentives</Tag> shows regional
            manager incentives based on branch production.
          </Step>
        </Section>
      )}

      {/* Common Topics */}
      <Section title="Common Topics">
        <Step n="•" title="How to verify a member's balance">
          Members can check their own account at <span className="font-mono text-xs bg-gray-100 px-1 rounded">triplej.ascendryxdigital.com/verify</span>
          using their MAF number and last name. They&apos;ll see payment history, due date, aging, and amount due.
        </Step>
        <Step n="•" title="Plan categories &amp; claimable rules">
          Claimable plans: <strong>Eucalyptus, Conifer, Rosewood</strong>. Cherry is for senior citizens (no claims —
          pay balance instead). Rosewood: only the member is insured, not beneficiaries.
        </Step>
        <Step n="•" title="Contestability periods for claims">
          Member death: 8 months (natural), <strong>0 months (accident)</strong>, 2 years (suicide). Beneficiary
          death: 8 months regardless of death type. Lapsed members are NOT claimable.
        </Step>
        <Step n="•" title="Spot Cash vs Spot Service">
          <strong>Spot Cash</strong> = alive member who pays the full 5-year contract upfront at 10% discount.
          <strong> Spot Service</strong> = non-member, already deceased, family requests mortuary service at ₱30,000
          minimum (editable for premium services).
        </Step>
        <Step n="•" title="BC Outright vs Deposit">
          In the remittance form, check <strong>BC Outright</strong> if the agent already took their Basic Commission
          on-site (reduces what the collector remits). Uncheck if BC stays in the deposit (agent receives separately).
          <strong>If the agent is deactivated, BC goes to the company automatically.</strong>
        </Step>
        <Step n="•" title="Updating old spreadsheet data">
          Click a member → scroll to the Payment Ledger → click any month cell to edit or add.
          The quarterly ₱1,260 amounts that should be ₱1,134 can be fixed via <Tag>Admin → Fix Grouped Quarterly Amounts</Tag>
          (admin only).
        </Step>
      </Section>

      {/* Support */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-semibold text-blue-900 mb-2">Need Help?</h2>
        <p className="text-sm text-blue-700">
          For technical issues or questions not covered here, contact the IT / head office via{" "}
          <a href="https://facebook.com/TripleJCares" target="_blank" rel="noopener noreferrer"
            className="font-semibold underline">Triple J Cares on Facebook</a> or message the admin directly.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number | string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
        {n}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <div className="text-sm text-gray-600 mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono">{children}</span>;
}
