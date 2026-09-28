import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { listImageAssets, storageBucketName } from "@/lib/admin/media-storage";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const items = await listImageAssets(user.email);
    // The picker uses this to explain why uploading is unavailable rather than
    // just failing when the button is pressed.
    return NextResponse.json({ items, uploadEnabled: Boolean(storageBucketName()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list media" },
      { status: 500 }
    );
  }
}
