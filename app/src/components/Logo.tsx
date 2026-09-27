import { Link } from 'react-router-dom';

// letter, shadow colour, rotation, lift at 56px, lift at 44px
const LETTERS: [string, string, number, number, number][] = [
  ['D', '#FF97AB', -4, 0, 0],
  ['e', '#FFE24D', 3, 4, 3],
  ['l', '#97DDD6', -2, 0, 0],
  ['i', '#D383FF', 5, 2, 2],
  ['S', '#FF844B', -3, 0, 0],
  ['h', '#B6FF80', 2, 3, 2],
  ['o', '#FF97AB', -5, 0, 0],
  ['p', '#97DDD6', 3, 2, 2],
];

/** The wobbly DeliShop wordmark. `lg` is the shop header, `md` everywhere else. */
export function Logo({ size = 'md', to }: { size?: 'lg' | 'md'; to?: string }) {
  const lg = size === 'lg';
  const shadow = lg ? 4 : 3;
  const letters = LETTERS.map(([ch, color, rot, liftLg, liftMd], i) => {
    const lift = lg ? liftLg : liftMd;
    return (
      <span
        key={i}
        style={{
          textShadow: `${shadow}px ${shadow}px 0 ${color}`,
          transform: `rotate(${rot}deg)` + (lift ? ` translateY(${lift}px)` : ''),
          marginLeft: ch === 'S' ? (lg ? 6 : 5) : undefined,
        }}
      >
        {ch}
      </span>
    );
  });
  const style = { fontSize: lg ? 56 : 44 };
  return to
    ? <Link to={to} className="logo" style={style} aria-label="DeliShop">{letters}</Link>
    : <div className="logo" style={style} aria-label="DeliShop">{letters}</div>;
}
