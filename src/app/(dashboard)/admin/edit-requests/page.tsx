import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, MONTHS, MOP_LABELS } from "@/lib/utils";
import EditRequestActions from "@/components/admin/EditRequestActions";
import MemberEditRequestActions from "@/components/admin/MemberEditRequestActions";

async function getRequests(status: string) {
  const requests = await db.paymentEditRequest.findMany({
    where: { status: status as any },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    requests.map(async (r) => {
      const [payment, requester] = await Promise.all([
        db.payment.findUnique({
          where: { id: r.paymentId },
          include: {
            member: { select: { mafNo: true, firstName: true, lastName: true } },
            collector: { select: { firstName: true, lastName: true } },
          },
        }),
        db.user.findUnique({
          where: { id: r.requestedBy },
          select: { username: true, branch: { select: { name: true } } },
        }),
      ]);
      return { ...r, payment, requester };
    })
  );
}

async function getMemberRequests(status: string) {
  const requests = await db.memberEditRequest.findMany({
    where: { status: status as any },
    include: {
      member: { select: { mafNo: true, firstName: true, lastName: true, planCategory: true, mopCode: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    requests.map(async (r) => {
      const requester = await db.user.findUnique({
        where: { id: r.requestedBy },
        select: { username: true, branch: { select: { name: true } } },
      });
      return { ...r, requester };
    })
  );
}

export default async function EditRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const status = searchParams.status ?? "PENDING";
  const [requests, memberRequests] = await Promise.all([
    getRequests(status),
    getMemberRequests(status),
  ]);

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Cash", GCASH: "GCash", BANK_TRANSFER: "Bank Transfer", OTHER: "Other",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review and approve or reject edit/delete requests from branch staff.</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <a
            key={s}
            href={`/admin/edit-requests?status=${s}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              status === s
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </a>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          No {status.toLowerCase()} requests.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            if (!req.payment) return null;
            const changes = req.changes as Record<string, any>;
            const p = req.payment;

            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className={`px-5 py-3 border-b flex items-center justify-between ${
                  req.status === "PENDING" ? "bg-amber-50 border-amber-100" :
                  req.status === "APPROVED" ? "bg-green-50 border-green-100" :
                  "bg-red-50 border-red-100"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      req.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                      req.status === "APPROVED" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {req.status}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {p.member.mafNo} — {p.member.firstName} {p.member.lastName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {MONTHS[p.periodMonth - 1]} {p.periodYear} · Installment #{p.installmentNo}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {req.requester?.username}
                    {req.requester?.branch?.name && ` · ${req.requester.branch.name}`}
                    {" · "}{new Date(req.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="px-5 py-4">
                  {/* Current vs Requested diff */}
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Current</p>
                      <dl className="text-sm space-y-1">
                        {changes.periodMonth !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Period</dt><dd>{MONTHS[p.periodMonth - 1]} {p.periodYear}</dd></div>
                        )}
                        {changes.installmentNo !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Installment</dt><dd>#{p.installmentNo}</dd></div>
                        )}
                        {changes.paymentDate !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Date Paid</dt><dd>{formatDate(p.paymentDate.toString())}</dd></div>
                        )}
                        {changes.amount !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Amount</dt><dd>{formatCurrency(Number(p.amount))}</dd></div>
                        )}
                        {changes.paymentMethod !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Method</dt><dd>{PAYMENT_METHOD_LABELS[p.paymentMethod]}</dd></div>
                        )}
                        {changes.isFree !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">FREE</dt><dd>{p.isFree ? "Yes" : "No"}</dd></div>
                        )}
                        {changes.notes !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Notes</dt><dd className="italic">{p.notes || "—"}</dd></div>
                        )}
                      </dl>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-blue-500 uppercase mb-2">Requested Change</p>
                      <dl className="text-sm space-y-1">
                        {changes.periodMonth !== undefined && (
                          <div className="flex gap-2">
                            <dt className="text-gray-400 w-28">Period</dt>
                            <dd className="font-semibold text-blue-700">
                              {MONTHS[(changes.periodMonth ?? p.periodMonth) - 1]} {changes.periodYear ?? p.periodYear}
                            </dd>
                          </div>
                        )}
                        {changes.installmentNo !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Installment</dt><dd className="font-semibold text-blue-700">#{changes.installmentNo}</dd></div>
                        )}
                        {changes.paymentDate !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Date Paid</dt><dd className="font-semibold text-blue-700">{formatDate(changes.paymentDate)}</dd></div>
                        )}
                        {changes.amount !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Amount</dt><dd className="font-semibold text-blue-700">{formatCurrency(changes.amount)}</dd></div>
                        )}
                        {changes.paymentMethod !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Method</dt><dd className="font-semibold text-blue-700">{PAYMENT_METHOD_LABELS[changes.paymentMethod]}</dd></div>
                        )}
                        {changes.isFree !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">FREE</dt><dd className="font-semibold text-blue-700">{changes.isFree ? "Yes" : "No"}</dd></div>
                        )}
                        {changes.notes !== undefined && (
                          <div className="flex gap-2"><dt className="text-gray-400 w-28">Notes</dt><dd className="font-semibold text-blue-700 italic">{changes.notes || "—"}</dd></div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="text-sm text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 mb-4">
                      Reason: {req.reason}
                    </div>
                  )}

                  {req.reviewNote && req.status !== "PENDING" && (
                    <div className={`text-sm rounded-lg px-3 py-2 mb-4 ${req.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      Admin note: {req.reviewNote}
                    </div>
                  )}

                  {req.status === "PENDING" && (
                    <EditRequestActions requestId={req.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Member Edit/Delete Requests ── */}
      {memberRequests.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-900 mt-8">Member Edit/Delete Requests</h2>
          <div className="space-y-4">
            {memberRequests.map((req) => {
              const changes = (req.changes ?? {}) as Record<string, any>;
              const m = req.member;
              const isDelete = req.requestType === "DELETE";

              return (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className={`px-5 py-3 border-b flex items-center justify-between ${
                    req.status === "PENDING" ? (isDelete ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100") :
                    req.status === "APPROVED" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isDelete ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {isDelete ? "DELETE" : "EDIT"}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        req.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                        req.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {req.status}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {m.mafNo} — {m.firstName} {m.lastName}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {req.requester?.username}
                      {req.requester?.branch?.name && ` · ${req.requester.branch.name}`}
                      {" · "}{new Date(req.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    {isDelete ? (
                      <p className="text-sm text-red-600 font-medium">Requesting to delete this member and all their records.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Current</p>
                          <dl className="text-sm space-y-1">
                            {changes.mopCode && changes.mopCode !== m.mopCode && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">MOP Code</dt><dd>{m.mopCode}</dd></div>
                            )}
                            {changes.planCategory && changes.planCategory !== m.planCategory && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">Plan</dt><dd>{m.planCategory}</dd></div>
                            )}
                            {changes.status && changes.status !== m.status && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">Status</dt><dd>{m.status}</dd></div>
                            )}
                            {changes.firstName && changes.firstName !== m.firstName && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">Name</dt><dd>{m.firstName} {m.lastName}</dd></div>
                            )}
                          </dl>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-blue-500 uppercase mb-2">Requested Change</p>
                          <dl className="text-sm space-y-1">
                            {changes.mopCode && changes.mopCode !== m.mopCode && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">MOP Code</dt><dd className="font-semibold text-blue-700">{changes.mopCode}</dd></div>
                            )}
                            {changes.planCategory && changes.planCategory !== m.planCategory && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">Plan</dt><dd className="font-semibold text-blue-700">{changes.planCategory}</dd></div>
                            )}
                            {changes.status && changes.status !== m.status && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">Status</dt><dd className="font-semibold text-blue-700">{changes.status}</dd></div>
                            )}
                            {changes.firstName && changes.firstName !== m.firstName && (
                              <div className="flex gap-2"><dt className="text-gray-400 w-28">Name</dt><dd className="font-semibold text-blue-700">{changes.firstName} {changes.lastName}</dd></div>
                            )}
                          </dl>
                        </div>
                      </div>
                    )}

                    {req.reason && (
                      <div className="text-sm text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 mb-4">
                        Reason: {req.reason}
                      </div>
                    )}

                    {req.reviewNote && req.status !== "PENDING" && (
                      <div className={`text-sm rounded-lg px-3 py-2 mb-4 ${req.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        Admin note: {req.reviewNote}
                      </div>
                    )}

                    {req.status === "PENDING" && (
                      <MemberEditRequestActions requestId={req.id} isDelete={isDelete} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
