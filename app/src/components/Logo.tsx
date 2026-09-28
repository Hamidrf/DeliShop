import { Link } from 'react-router-dom';

const LOGO_SRC = '/assets/delnia-logo.png';

/** Delnia's own hand-drawn logo, framed like the shop's other paper stickers. `lg` is the shop header, `md` everywhere else. */
export function Logo({ size = 'md', to }: { size?: 'lg' | 'md'; to?: string }) {
  const px = size === 'lg' ? 64 : 48;
  const img = (
    <img
      src={LOGO_SRC}
      alt="DeliShop"
      width={px}
      height={px}
      style={{
        display: 'block',
        borderRadius: 14,
        border: '2.5px solid var(--ink)',
        boxShadow: '3px 3px 0 var(--ink)',
        transform: 'rotate(-2deg)',
      }}
    />
  );
  return to ? <Link to={to} className="logo">{img}</Link> : <div className="logo">{img}</div>;
}
