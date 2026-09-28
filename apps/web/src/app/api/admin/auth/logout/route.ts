import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthCookieName } from "@/lib/admin/auth";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(adminAuthCookieName);
  redirect("/admin/login");
}
