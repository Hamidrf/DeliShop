/** Shown while a page's code is still loading (the Suspense fallback in main.tsx). */
export function PageLoader() {
  return (
    <div className="page loader" role="status" aria-live="polite">
      <img src="/assets/delnia-logo.png" alt="" width={64} height={64} className="loader-mark" />
      <div className="loader-dots" aria-hidden="true">
        <span className="loader-dot" style={{ background: 'var(--pink)' }} />
        <span className="loader-dot" style={{ background: 'var(--yellow)', animationDelay: '.15s' }} />
        <span className="loader-dot" style={{ background: 'var(--mint)', animationDelay: '.3s' }} />
      </div>
      <span className="hand" style={{ fontSize: 20, color: 'var(--faint)' }}>Loading…</span>
    </div>
  );
}
