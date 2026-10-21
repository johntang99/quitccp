"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

export function AdminPasswordInput() {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {t("admin.field.password")}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="admin-input" name="password" type={visible ? "text" : "password"} />
        <button
          type="button"
          className="admin-btn"
          aria-label={visible ? t("admin.field.aria.passwordHide") : t("admin.field.aria.passwordShow")}
          onClick={() => setVisible((current) => !current)}
          style={{ minWidth: 72, paddingInline: 10 }}
        >
          {visible ? t("admin.field.passwordHide") : t("admin.field.passwordShow")}
        </button>
      </div>
    </label>
  );
}
