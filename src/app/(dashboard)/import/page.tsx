import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import ImportForm from "@/components/ImportForm";

export default async function ImportPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const branches = await db.branch.findMany({ orderBy: { name: "asc" } });

  // Get current counts for reference
  const memberCount = await db.member.count();
  const paymentCount = await db.payment.count();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Records</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload CSV files to bulk-import member records and payment history.
          </p>
        </div>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{memberCount.toLocaleString()} members</span>
          <span>{paymentCount.toLocaleString()} payments</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        <p className="font-semibold mb-2">Import Order</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li><strong>Step 1 — Import Members</strong>: Upload the <em>Plan Holder Enrollee&apos;s Details</em> CSV. This creates member profiles, beneficiaries, and auto-creates agent/collector employees.</li>
          <li><strong>Step 2 — Import Payments</strong>: Upload the <em>Plan Holders Payment Records</em> CSV. This creates payment history from the monthly columns (April21, May21, etc.). Members must exist first.</li>
        </ol>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-blue-100 rounded p-2">
            <p className="font-medium text-xs mb-1">Members CSV columns:</p>
            <p className="font-mono text-[10px] leading-tight">
              MAF | DATE | INSURANCE TYPE | Plan Category | MOP | Code | FIRST NAME | Middle Name | LAST NAME | Sales Agent | COLLECTOR | Address | DOB | Age | Religion | Contact | Occupation | Civil Status | Gender | Beneficiaries...
            </p>
          </div>
          <div className="bg-green-100 rounded p-2 text-green-800">
            <p className="font-medium text-xs mb-1">Payments CSV columns:</p>
            <p className="font-mono text-[10px] leading-tight">
              No | Status | MAF No. | DATE | MOP | PLAN CATEGORY | Name (3 cols) | SALES AGENT | FREE | April21 | May21 | June21 | ... | Total Payment | Comm/NComm
            </p>
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-blue-700">
          <li>• Existing MAF numbers are skipped (no duplicates)</li>
          <li>• Members with existing payments are skipped during payment import</li>
          <li>• Agents/Collectors are auto-created as employees if not found</li>
          <li>• FREE months are imported as installment #1 with ₱0 amount</li>
        </ul>
      </div>

      <ImportForm branches={branches} />
    </div>
  );
}
