"use client";

import { useState } from "react";

interface Branch { id: string; name: string; address?: string }
interface User { id: string; username: string; role: string; branch?: Branch }
interface Agent { id: string; code: string; firstName: string; lastName: string; phone?: string; branch: Branch }
interface Collector { id: string; code: string; firstName: string; lastName: string; phone?: string; branch: Branch }

type Tab = "branches" | "users" | "agents" | "collectors";

export default function AdminPanel({ branches, users, agents, collectors }: {
  branches: Branch[];
  users: User[];
  agents: Agent[];
  collectors: Collector[];
}) {
  const [tab, setTab] = useState<Tab>("branches");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [localBranches, setLocalBranches] = useState(branches);
  const [localUsers, setLocalUsers] = useState(users);
  const [localAgents, setLocalAgents] = useState(agents);
  const [localCollectors, setLocalCollectors] = useState(collectors);

  function setF(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function save(type: Tab) {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type === "branches" ? "branch" : type === "users" ? "user" : type === "agents" ? "agent" : "collector", data: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setMsg("Saved successfully!");
      setForm({});
      if (type === "branches") setLocalBranches((p) => [...p, data]);
      if (type === "users") setLocalUsers((p) => [...p, data]);
      if (type === "agents") setLocalAgents((p) => [...p, data]);
      if (type === "collectors") setLocalCollectors((p) => [...p, data]);
    } catch (err: any) {
      setMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "branches", label: "Branches" },
    { key: "users", label: "Users" },
    { key: "agents", label: "Agents" },
    { key: "collectors", label: "Collectors" },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(""); setForm({}); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Add form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            Add {tab === "branches" ? "Branch" : tab === "users" ? "User" : tab === "agents" ? "Agent" : "Collector"}
          </h2>

          <div className="space-y-3">
            {tab === "branches" && (
              <>
                <div>
                  <label className="label">Branch Name *</label>
                  <input className="input" value={form.name ?? ""} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Kidapawan Branch" />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" value={form.address ?? ""} onChange={(e) => setF("address", e.target.value)} />
                </div>
              </>
            )}

            {tab === "users" && (
              <>
                <div>
                  <label className="label">Username *</label>
                  <input className="input" value={form.username ?? ""} onChange={(e) => setF("username", e.target.value)} />
                </div>
                <div>
                  <label className="label">Password *</label>
                  <input type="password" className="input" value={form.password ?? ""} onChange={(e) => setF("password", e.target.value)} />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <select className="input" value={form.role ?? ""} onChange={(e) => setF("role", e.target.value)}>
                    <option value="">Select Role</option>
                    <option value="ADMIN">Admin</option>
                    <option value="BRANCH_STAFF">Branch Staff</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
                {form.role === "BRANCH_STAFF" && (
                  <div>
                    <label className="label">Branch *</label>
                    <select className="input" value={form.branchId ?? ""} onChange={(e) => setF("branchId", e.target.value)}>
                      <option value="">Select Branch</option>
                      {localBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            {(tab === "agents" || tab === "collectors") && (
              <>
                <div>
                  <label className="label">Code *</label>
                  <input className="input" value={form.code ?? ""} onChange={(e) => setF("code", e.target.value)} placeholder="e.g. AGT-001" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">First Name *</label>
                    <input className="input" value={form.firstName ?? ""} onChange={(e) => setF("firstName", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Last Name *</label>
                    <input className="input" value={form.lastName ?? ""} onChange={(e) => setF("lastName", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone ?? ""} onChange={(e) => setF("phone", e.target.value)} />
                </div>
                <div>
                  <label className="label">Branch *</label>
                  <select className="input" value={form.branchId ?? ""} onChange={(e) => setF("branchId", e.target.value)}>
                    <option value="">Select Branch</option>
                    {localBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {msg && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {msg}
            </div>
          )}

          <button onClick={() => save(tab)} disabled={saving}
            className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            {saving ? "Saving..." : "Add"}
          </button>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            {tab === "branches" ? `Branches (${localBranches.length})` :
             tab === "users" ? `Users (${localUsers.length})` :
             tab === "agents" ? `Agents (${localAgents.length})` :
             `Collectors (${localCollectors.length})`}
          </h2>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tab === "branches" && localBranches.map((b) => (
              <div key={b.id} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                <span className="font-medium text-gray-800">{b.name}</span>
                <span className="text-gray-400 text-xs">{b.address ?? "—"}</span>
              </div>
            ))}
            {tab === "users" && localUsers.map((u) => (
              <div key={u.id} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{u.username}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${u.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{u.role}</span>
                </div>
                <span className="text-gray-400 text-xs">{u.branch?.name ?? "All branches"}</span>
              </div>
            ))}
            {tab === "agents" && localAgents.map((a) => (
              <div key={a.id} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{a.firstName} {a.lastName}</span>
                  <span className="text-gray-400 ml-1 text-xs">({a.code})</span>
                </div>
                <span className="text-gray-400 text-xs">{a.branch.name}</span>
              </div>
            ))}
            {tab === "collectors" && localCollectors.map((c) => (
              <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{c.firstName} {c.lastName}</span>
                  <span className="text-gray-400 ml-1 text-xs">({c.code})</span>
                </div>
                <span className="text-gray-400 text-xs">{c.branch.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Fix Tools */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Data Fix Tools</h2>
        <div className="flex flex-wrap gap-3">
          <FixButton
            label="Fix Grouped Quarterly Amounts"
            description="Fix only grouped payments (e.g., 3 payments on same date) to use discounted rate. Single monthly payments are NOT changed."
            endpoint="/api/admin/fix-quarterly"
          />
        </div>
      </div>
    </div>
  );
}

function FixButton({ label, description, endpoint }: { label: string; description: string; endpoint: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (!confirm(`Run "${label}"? This will modify payment records.`)) return;
    setRunning(true); setResult(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(`${data.message}\n${(data.details ?? []).join("\n")}`);
    } catch (e: any) {
      setResult("Error: " + e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 max-w-sm">
      <p className="font-medium text-sm text-gray-800">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
      <button onClick={run} disabled={running}
        className="mt-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg">
        {running ? "Running..." : "Run Fix"}
      </button>
      {result && (
        <pre className="mt-2 bg-gray-50 rounded-lg p-2 text-[10px] text-gray-600 max-h-40 overflow-y-auto whitespace-pre-wrap">{result}</pre>
      )}
    </div>
  );
}
