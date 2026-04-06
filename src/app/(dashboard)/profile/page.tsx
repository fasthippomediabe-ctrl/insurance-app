import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  const user = session!.user as any;

  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, username: true, role: true, displayName: true,
      email: true, phone: true, avatar: true,
      branch: { select: { name: true } },
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Update your personal information and password</p>
      </div>
      <ProfileForm profile={{
        ...profile!,
        branch: profile?.branch?.name ?? null,
      }} />
    </div>
  );
}
