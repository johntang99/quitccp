"use client";

import { useState } from "react";

export function AdminPasswordInput() {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      密码
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="admin-input" name="password" type={visible ? "text" : "password"} />
        <button
          type="button"
          className="admin-btn"
          aria-label={visible ? "隐藏密码" : "显示密码"}
          onClick={() => setVisible((current) => !current)}
          style={{ minWidth: 72, paddingInline: 10 }}
        >
          {visible ? "隐藏" : "查看"}
        </button>
      </div>
    </label>
  );
}
