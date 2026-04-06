import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, POSITION_LABELS, COMMISSION_POSITIONS } from "@/lib/utils";
import { EmployeePosition } from "@prisma/client";
import PromoteButton from "@/components/employees/PromoteButton";
import DemoteButton from "@/components/employees/DemoteButton";
import ToggleActiveButton from "@/components/employees/ToggleActiveButton";

const POSITION_COLORS: Record<string, string> = {
  MO: "bg-blue-100 text-blue-700",
  AO: "bg-teal-100 text-teal-700",
  MH: "bg-purple-100 text-purple-700",
  AM: "bg-indigo-100 text-indigo-700",
  BS: "bg-gray-100 text-gray-600",
  BM: "bg-green-100 text-green-700",
  RM: "bg-orange-100 text-orange-700",
  TH: "bg-red-100 text-red-700",
  EVP: "bg-yellow-100 text-yellow-700",
  CEO: "bg-pink-100 text-pink-700",
  CHR: "bg-rose-100 text-rose-800",
};

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const [employee, promotionHistory] = await Promise.all([
    db.employee.findUnique({
      where: { id: params.id },
      include: {
        branch: true,
        sponsor: true,
        recruits: {
          where: { isActive: true },
          orderBy: { lastName: "asc" },
          include: { branch: true },
        },
        positions: { orderBy: { dateGranted: "asc" } },
        _count: { select: { agentMembers: true, collectorMembers: true } },
      },
    }),
    db.promotionHistory.findMany({
      where: { employeeId: params.id },
      orderBy: { promotedDate: "desc" },
    }),
  ]);

  if (!employee) notFound();

  const activePositions = employee.positions.filter((p) => p.isActive);
  const isCommission = COMMISSION_POSITIONS.includes(employee.primaryPosition);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Inactive banner */}
      {!employee.isActive && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-red-700 font-semibold text-sm">This employee is inactive</p>
            <p className="text-red-500 text-xs">They are excluded from remittance forms, incentive calculations, and active lists.</p>
          </div>
          <ToggleActiveButton
            employeeId={employee.id}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            isActive={false}
          />
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/employees" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.firstName} {employee.middleName ? employee.middleName[0] + ". " : ""}{employee.lastName}
              {employee.nickname && (
                <span className="text-base font-normal text-gray-400 ml-2">"{employee.nickname}"</span>
              )}
            </h1>
            <p className="text-sm text-gray-500">{employee.employeeNo} · {employee.branch.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ToggleActiveButton
            employeeId={employee.id}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            isActive={employee.isActive}
          />
          <DemoteButton
            employeeId={employee.id}
            primaryPosition={employee.primaryPosition}
            activePositions={activePositions.map((p) => p.position)}
          />
          <PromoteButton
            employeeId={employee.id}
            currentPositions={activePositions.map((p) => p.position)}
            isAdmin={user.role === "ADMIN"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Current Positions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Current Positions</h2>
            <div className="space-y-3">
              {activePositions.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${POSITION_COLORS[p.position] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.position}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {POSITION_LABELS[p.position]}
                        {p.position === employee.primaryPosition && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-normal">Primary</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">Granted {formatDate(p.dateGranted)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${COMMISSION_POSITIONS.includes(p.position as any) ? "text-orange-600" : "text-green-600"}`}>
                    {COMMISSION_POSITIONS.includes(p.position as any) ? "Commission" : "Salaried"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Personal Information</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-400 text-xs">Date of Birth</dt>
                <dd className="font-medium text-gray-800">{formatDate(employee.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Gender</dt>
                <dd className="font-medium text-gray-800">{employee.gender ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Civil Status</dt>
                <dd className="font-medium text-gray-800">{employee.civilStatus ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Contact Number</dt>
                <dd className="font-medium text-gray-800">{employee.contactNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Email</dt>
                <dd className="font-medium text-gray-800">{employee.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Date Hired</dt>
                <dd className="font-medium text-gray-800">{formatDate(employee.dateHired)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-400 text-xs">Address</dt>
                <dd className="font-medium text-gray-800">{employee.address ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Promotion History */}
          {promotionHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Promotion History</h2>
              <div className="space-y-3">
                {promotionHistory.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {h.fromPosition && (
                          <>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[h.fromPosition] ?? "bg-gray-100 text-gray-600"}`}>
                              {h.fromPosition}
                            </span>
                            <span className="text-gray-400 text-xs">→</span>
                          </>
                        )}
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[h.toPosition] ?? "bg-gray-100 text-gray-600"}`}>
                          {h.toPosition}
                        </span>
                        {h.notes?.startsWith("[DEMOTION]")
                          ? <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Demotion</span>
                          : <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Promotion</span>
                        }
                        {i === 0 && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Latest</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(h.promotedDate)}
                        {h.notes ? ` · ${h.notes.replace("[DEMOTION] ", "").replace("[DEMOTION]", "")}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recruits (downline) */}
          {employee.recruits.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-1 pb-2 border-b">
                Recruits / Downline
                <span className="ml-2 text-sm font-normal text-gray-400">({employee.recruits.length})</span>
              </h2>
              <p className="text-xs text-gray-400 mb-4">These employees were recruited by this person (commission cascade upline).</p>
              <div className="space-y-2">
                {employee.recruits.map((r) => (
                  <Link key={r.id} href={`/employees/${r.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {r.firstName} {r.lastName}
                      </p>
                      <p className="text-xs text-gray-400">{r.employeeNo} · {r.branch.name}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${POSITION_COLORS[r.primaryPosition] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.primaryPosition}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — summary card */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="text-center">
              {/* Avatar initials */}
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3"
                style={{ background: "#1535b0" }}>
                {employee.firstName[0]}{employee.lastName[0]}
              </div>
              <p className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{employee.employeeNo}</p>
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                {activePositions.map((p) => (
                  <span key={p.id} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${POSITION_COLORS[p.position] ?? "bg-gray-100 text-gray-600"}`}>
                    {p.position}
                  </span>
                ))}
              </div>
              <div className={`mt-3 text-xs font-medium ${isCommission ? "text-orange-600" : "text-green-600"}`}>
                {isCommission ? "Commission-Based" : "Salaried (Monthly)"}
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Branch</span>
                <span className="font-medium text-gray-800">{employee.branch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`font-medium ${employee.isActive ? "text-green-600" : "text-red-500"}`}>
                  {employee.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sponsor</span>
                <span className="font-medium text-gray-800">
                  {employee.sponsor
                    ? <Link href={`/employees/${employee.sponsor.id}`} className="text-blue-600 hover:underline">
                        {employee.sponsor.firstName} {employee.sponsor.lastName}
                      </Link>
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Recruits</span>
                <span className="font-medium text-gray-800">{employee.recruits.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Members (agent)</span>
                <span className="font-medium text-gray-800">{employee._count.agentMembers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Members (collector)</span>
                <span className="font-medium text-gray-800">{employee._count.collectorMembers}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
