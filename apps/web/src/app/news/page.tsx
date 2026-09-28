import { PageFromRoute } from "@/components/PageFromRoute";

// CMS-driven, same reason as the homepage.
export const revalidate = 300;

export default function NewsIndexPage() {
  return <PageFromRoute section="news" slug="index" />;
}
