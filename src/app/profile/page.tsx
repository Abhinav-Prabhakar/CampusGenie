"use client";

import SidebarNav from "@/components/primitives/SidebarNav";
import ProfileView from "@/components/profile/ProfileView";

export default function ProfilePage() {
  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        activeTitle="Student Profile"
        activeNav="profile"
        footerLabel="Profile"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        <ProfileView />
      </div>
    </main>
  );
}
