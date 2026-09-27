import { Link } from 'react-router-dom';
import { Logo } from './Logo';

/** Header shared by the studio (admin) pages. */
export function StudioHeader({ links }: { links: { to: string; label: string }[] }) {
  return (
    <header className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Logo />
        <span className="studio-badge">Studio</span>
      </div>
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {links.map(l => <Link key={l.to} to={l.to} className="pill">{l.label}</Link>)}
      </nav>
    </header>
  );
}
