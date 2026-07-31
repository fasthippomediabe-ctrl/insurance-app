import Link from "next/link";

// Triple J Corp brand colors
const BRAND = {
  blue: "#1535b0",
  blueDark: "#0e2580",
  blueLight: "#1a40cc",
  gold: "#c9a227",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Triple J Corp." width={80} className="rounded-xl mx-auto" />
          <h1 className="text-3xl font-black mt-2" style={{ color: BRAND.blue }}>
            TRIPLE J <span style={{ color: BRAND.gold }}>CORP.</span>
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Forgot your password?</h2>
          <p className="text-gray-500 text-sm mb-6">
            For security, passwords can only be reset by a system administrator.
          </p>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-semibold text-gray-900">To reset your password:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Contact your system administrator.</li>
              <li>
                An admin can reset it under{" "}
                <span className="font-semibold">Admin → Users</span>.
              </li>
              <li>Sign in with the temporary password, then change it in your profile.</li>
            </ol>
            <p className="pt-1 text-gray-500">
              Tip: usernames are not case-sensitive, but double-check for typos.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-6 block w-full text-center text-white font-bold py-3.5 rounded-xl text-sm tracking-widest shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.blueLight} 100%)`,
              letterSpacing: "0.15em",
            }}
          >
            BACK TO SIGN IN
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Triple J Corp. &copy; {new Date().getFullYear()} — All rights reserved
        </p>
      </div>
    </div>
  );
}
