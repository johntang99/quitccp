import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";

export default async function AdminHomePage() {
  const user = await getAdminSessionUser();
  if (user) redirect("/admin/dashboard");
  redirect("/admin/login");
}
