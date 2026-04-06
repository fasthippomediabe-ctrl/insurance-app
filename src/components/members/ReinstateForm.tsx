"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, MONTHS } from "@/lib/utils";

interface Props {
  member: {
    id: string;
    mafNo: string;
    firstName: string;
    lastName: string;
    planCategory: string;
    mopCode: string;
    monthlyDue: number;
    lastInstallment: number;
    currentAgentId: string;
    currentAgentName: string;
    branchId: string;
  };
  unpaidMonths: { month: number; year: number }[];
  agents: { id: string; name: string; position: string }[];
}

const REINSTATEMENT_FEE = 100;
const MIN_MONTHS = 2;

export default function ReinstateForm({ member, unpaidMonths, agents }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"REDATE" | "UPDATE">("REDATE");
  const [newAgentId, setNewAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const totalUnpaid = unpaidMonths.length;
  const updateCost = (totalUnpaid * member.monthlyDue) + REINSTATEMENT_FEE;
  const redateCost = (MIN_MONTHS * member.monthlyDue) + REINSTATEMENT_FEE;

  const totalDue = type === "UPDATE" ? updateCost : redateCost;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newAgentId) { setError("Please select the reinstating agent."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/members/${member.id}/reinstate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          newAgentId,
          reinstatementFee: REINSTATEMENT_FEE,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to reinstate");
      }

      setSuccess(true);
      setTimeout(() => router.push(`/members/${member.id}`), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedAgent = agents.find(a => a.id === newAgentId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">Member reinstated successfully! Redirecting...</div>}

      {/* Account Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">MAF No.</p>
            <p className="font-bold">{member.mafNo}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Plan</p>
            <p className="font-bold">{member.planCategory}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">MOP</p>
            <p className="font-bold">{member.mopCode}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Monthly Due</p>
            <p className="font-bold">{formatCurrency(member.monthlyDue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Last Installment</p>
            <p className="font-bold">#{member.lastInstallment}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Current Agent</p>
            <p className="font-bold">{member.currentAgentName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Unpaid Months</p>
            <p className="font-bold text-red-600">{totalUnpaid} months</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Status</p>
            <p className="font-bold text-red-600">LAPSED</p>
          </div>
        </div>

        {/* Unpaid months list */}
        {unpaidMonths.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-400 mb-2">Unpaid Months:</p>
            <div className="flex flex-wrap gap-1">
              {unpaidMonths.map((um, i) => (
                <span key={i} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {MONTHS[um.month - 1]?.slice(0, 3)} {um.year}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reinstatement Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reinstatement Type</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
            type === "REDATE" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input type="radio" name="type" value="REDATE" checked={type === "REDATE"}
              onChange={() => setType("REDATE")} className="sr-only" />
            <p className="font-bold text-gray-900">Redating</p>
            <p className="text-xs text-gray-500 mt-1">
              Start fresh from reinstatement month. Unpaid months counter resets. Continue from installment #{member.lastInstallment + 1}.
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-400">Required Payment:</p>
              <p className="font-bold text-lg text-purple-700">{formatCurrency(redateCost)}</p>
              <p className="text-[10px] text-gray-400">
                {MIN_MONTHS} months ({formatCurrency(member.monthlyDue)} x {MIN_MONTHS}) + {formatCurrency(REINSTATEMENT_FEE)} fee
              </p>
            </div>
          </label>

          <label className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
            type === "UPDATE" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input type="radio" name="type" value="UPDATE" checked={type === "UPDATE"}
              onChange={() => setType("UPDATE")} className="sr-only" />
            <p className="font-bold text-gray-900">Updating</p>
            <p className="text-xs text-gray-500 mt-1">
              Pay all {totalUnpaid} missed months to catch up. No gaps in payment history.
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-400">Required Payment:</p>
              <p className="font-bold text-lg text-purple-700">{formatCurrency(updateCost)}</p>
              <p className="text-[10px] text-gray-400">
                {totalUnpaid} months ({formatCurrency(member.monthlyDue)} x {totalUnpaid}) + {formatCurrency(REINSTATEMENT_FEE)} fee
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* New Agent Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Reinstating Agent</h2>
        <p className="text-xs text-gray-500 mb-4">
          The agent who processes this reinstatement will be assigned as the new sales agent for this account and will earn commission/production if still commissionable.
        </p>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={newAgentId} onChange={(e) => setNewAgentId(e.target.value)} required
        >
          <option value="">— Select Agent —</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.position})</option>
          ))}
        </select>
        {selectedAgent && member.currentAgentId !== newAgentId && (
          <p className="text-xs text-amber-600 mt-2">
            Agent will change from <strong>{member.currentAgentName}</strong> to <strong>{selectedAgent.name}</strong>
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-purple-900 mb-3">Reinstatement Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-purple-700">Type</span>
            <span className="font-bold text-purple-900">{type === "REDATE" ? "Redating" : "Updating"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">{type === "UPDATE" ? `${totalUnpaid} missed months` : `${MIN_MONTHS} months advance`}</span>
            <span className="font-bold">{formatCurrency(type === "UPDATE" ? totalUnpaid * member.monthlyDue : MIN_MONTHS * member.monthlyDue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">Reinstatement Fee</span>
            <span className="font-bold">{formatCurrency(REINSTATEMENT_FEE)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-purple-300">
            <span className="text-purple-900 font-bold">Total Due</span>
            <span className="font-black text-xl text-purple-900">{formatCurrency(totalDue)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href={`/members/${member.id}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        <button type="submit" disabled={loading || success}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Processing..." : `Reinstate — ${formatCurrency(totalDue)}`}
        </button>
      </div>
    </form>
  );
}
