"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Triple J Corp brand colors
const BRAND = {
  blue: "#1535b0",
  blueDark: "#0e2580",
  blueLight: "#1a40cc",
  teal: "#4a9cc7",
  gold: "#c9a227",
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid username or password.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${BRAND.blueLight} 0%, ${BRAND.blue} 50%, ${BRAND.blueDark} 100%)` }}
      >
        {/* Background circles for depth */}
        <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full opacity-10"
          style={{ background: BRAND.teal }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full opacity-10"
          style={{ background: BRAND.gold }} />

        <div className="relative z-10 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Triple J Corp." width={150} className="drop-shadow-2xl rounded-2xl" />
          <h1 className="text-5xl font-black text-white tracking-widest mt-6 text-center">
            TRIPLE J
          </h1>
          <h2 className="text-2xl font-bold tracking-[0.3em] mt-1 text-center"
            style={{ color: BRAND.gold }}>
            CORP.
          </h2>
          <div className="w-20 h-0.5 mt-6 rounded-full" style={{ backgroundColor: BRAND.gold }} />
          <p className="text-sm mt-5 text-center font-light tracking-wide"
            style={{ color: "rgba(255,255,255,0.65)" }}>
            Insurance Management System
          </p>
          <p className="text-xs mt-2 text-center"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            Secure · Reliable · Multi-Branch
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Triple J Corp." width={80} className="rounded-xl mx-auto" />
            <h1 className="text-3xl font-black mt-2" style={{ color: BRAND.blue }}>
              TRIPLE J <span style={{ color: BRAND.gold }}>CORP.</span>
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-400 text-sm mb-7">Sign in to continue to your dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none bg-gray-50 transition-all"
                  style={{ outlineColor: BRAND.blue }}
                  onFocus={(e) => e.target.style.borderColor = BRAND.blue}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none bg-gray-50 transition-all"
                  onFocus={(e) => e.target.style.borderColor = BRAND.blue}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm tracking-widest shadow-lg transition-opacity"
                style={{
                  background: loading
                    ? "#94a3b8"
                    : `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.blueLight} 100%)`,
                  letterSpacing: "0.15em",
                }}
              >
                {loading ? "SIGNING IN..." : "SIGN IN"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Triple J Corp. &copy; {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
