export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const css = `
    body > header,
    body > footer {
      display: none !important;
    }

    .admin-logo-header {
      background: #2f2366;
      border-bottom: 1px solid rgba(255, 255, 255, 0.16);
    }

    .admin-logo-header .wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 32px;
    }

    .admin-logo {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #f8ecb4;
      text-decoration: none;
    }

    .admin-logo-mark {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #f0cd68;
      color: #2f2366;
      font-weight: 800;
      font-size: 16px;
    }

    .admin-logo-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .admin-logo-text b {
      font-size: 26px;
      font-weight: 700;
      color: #f8ecb4;
    }
  `;

  return (
    <>
      <style>{css}</style>

      <header className="admin-logo-header" aria-label="Admin header">
        <div className="wrap">
          <div className="admin-logo">
            <span className="admin-logo-mark">退黨</span>
            <span className="admin-logo-text">
              <b>全球退党服务中心</b>
            </span>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
