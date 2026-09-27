import { Link, useNavigate } from 'react-router-dom';
import { useLogout } from '../lib/auth';
import { Logo } from './Logo';

/** Header shared by the studio (admin) pages. */
export function StudioHeader({ links }: { links: { to: string; label: string }[] }) {
  const navigate = useNavigate();
  const logout = useLogout();
  return (
    <header className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Logo />
        <span className="studio-badge">Studio</span>
      </div>
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {links.map(l => <Link key={l.to} to={l.to} className="pill">{l.label}</Link>)}
        <button
          type="button"
          className="pill"
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/studio/login') })}
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
