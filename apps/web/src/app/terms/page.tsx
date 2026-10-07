import { redirect } from "next/navigation";

/**
 * `/terms` was a placeholder page with no real content. The terms of service
 * now live in the CMS at /legal/terms, imported from the old site; this keeps
 * the old address working.
 */
export default function TermsPage() {
  redirect("/legal/terms");
}
