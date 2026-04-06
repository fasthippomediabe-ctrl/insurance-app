"use client";

import { signOut } from "next-auth/react";
import { Session } from "next-auth";

export default function TopBar({ session, onMenuToggle }: { session: Session; onMenuToggle?: () => void }) {
  const user = session.user as any;

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {user.branchName && (
          <>
            <span className="text-gray-400 hidden sm:inline">Branch:</span>
            <span className="font-semibold px-2.5 py-0.5 rounded-full text-xs"
              style={{ background: "rgba(21,53,176,0.08)", color: "#1535b0" }}>
              {user.branchName}
            </span>
          </>
        )}
        {!user.branchName && (
          <span className="font-semibold px-2.5 py-0.5 rounded-full text-xs"
            style={{ background: "rgba(240,180,41,0.15)", color: "#b07d10" }}>
            All Branches
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "#1535b0" }}>
            {user.username?.[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-gray-600 hidden sm:inline">
            <span className="font-semibold text-gray-800">{user.username}</span>
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border"
          style={{ color: "#1535b0", borderColor: "#1535b0" }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1535b0";
            (e.currentTarget as HTMLButtonElement).style.color = "white";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#1a3a6b";
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
