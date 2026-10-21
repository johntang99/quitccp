import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <section className="sec">
      <div className="wrap">
        <article className="sectionCard">
          <h1 className="sectionTitle">{t("notFound.title")}</h1>
          <p className="muted">{t("notFound.body")}</p>
          <div className="hero-cta">
            <Link className="btn btn--seal" href="/">
              {t("notFound.home")}
            </Link>
            <Link className="btn btn--line" href="/search">
              {t("notFound.search")}
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
