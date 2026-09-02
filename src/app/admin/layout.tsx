import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/appUsers";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "admin") redirect("/");
  return <>{children}</>;
}
