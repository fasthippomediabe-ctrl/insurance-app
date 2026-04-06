"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string; username: string; role: string; displayName: string | null;
  email: string | null; phone: string | null; avatar: string | null; branch: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator", BRANCH_STAFF: "Branch Staff", HR: "Human Resources",
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) { setError("Image too large. Max 1MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setLoading(true); setMsg(""); setError("");

    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords don't match."); setLoading(false); return;
    }
    if (newPassword && newPassword.length < 6) {
      setError("New password must be at least 6 characters."); setLoading(false); return;
    }

    try {
      const body: any = { displayName, email, phone, avatar };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      setMsg("Profile updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Avatar & Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Profile Picture</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: "#1535b0" }}>
                {profile.username[0]?.toUpperCase()}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()}
              className="text-sm text-blue-600 hover:underline font-medium">
              Upload Photo
            </button>
            {avatar && (
              <button onClick={() => setAvatar(null)} className="text-sm text-red-500 hover:underline ml-3">
                Remove
              </button>
            )}
            <p className="text-xs text-gray-400 mt-1">Max 1MB. JPG or PNG.</p>
          </div>
        </div>
      </div>

      {/* Account Info (read-only) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Username</p>
            <p className="font-bold">{profile.username}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Role</p>
            <p className="font-bold">{ROLE_LABELS[profile.role] ?? profile.role}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Branch</p>
            <p className="font-bold">{profile.branch ?? "All Branches"}</p>
          </div>
        </div>
      </div>

      {/* Editable Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want your name displayed" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XX-XXX-XXXX" />
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
            <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={loading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
