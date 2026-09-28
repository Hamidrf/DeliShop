import { useCallback, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { cropStyle, type Product } from '../../lib/products';
import { KEYS, addToBag, useCatalog, useStored, type BagEntry } from '../../lib/store';
import { CAT_COLOR, FILTERS, INK, bgImage, type CategoryFilter } from '../../lib/theme';
import { ProductModal } from './ProductModal';
import './Shop.css';

/** Seconds for the colour to drip down a card on hover. */
const DRIP_SECONDS = 0.9;
/** Show every card in colour, without waiting for hover. */
const ALWAYS_COLOR = false;

const DRIP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 220" preserveAspectRatio="none"><path fill="#000" d="M0 0H100V100C96 100 95 106 93 112C92 116 88 116 87 112C85 104 80 102 74 103C70 104 69 108 67 110C65 112 62 111 61 108C59 103 52 101 46 103C42 104 41 114 38 116C35 118 32 115 31 111C30 105 24 101 18 103C14 104 13 108 11 109C8 110 6 106 5 104C4 102 2 101 0 101Z"/></svg>';
const DRIP = `url("data:image/svg+xml,${encodeURIComponent(DRIP_SVG)}")`;
const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.6];

function CardArt({ p }: { p: Product }) {
  const ar = p.w / p.h;
  return (
    <div className="card-art">
      <div className="crop" style={{ width: `min(100cqw, calc(100cqh * ${ar.toFixed(4)}))`, aspectRatio: ar.toFixed(4) }}>
        <img
          src={p.src}
          alt=""
          style={{ ...cropStyle(p), mixBlendMode: 'multiply', filter: p.photo ? 'contrast(1.35) brightness(1.12) saturate(1.2)' : 'contrast(1.25) brightness(1.08)' }}
        />
      </div>
    </div>
  );
}

export default function Shop() {
  const navigate = useNavigate();
  const all = useCatalog('shop');
  const bag = useStored<BagEntry>(KEYS.bag);
  const bagCount = bag.reduce((n, b) => n + b.qty, 0);
  const [bump, setBump] = useState(0);
  const [cat, setCat] = useState<CategoryFilter>('All');
  const [openName, setOpenName] = useState<string | null>(null);
  const closeModal = useCallback(() => setOpenName(null), []);

  const list = all.filter(p => cat === 'All' || p.cat === cat);
  const open = all.find(p => p.name === openName);

  const add = (p: Product) => { addToBag(p); setBump(b => b + 1); };

  return (
    <div className="page">
      <div className="page-inner shop">
        <header className="page-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Logo size="lg" />
            <div className="hand" style={{ fontSize: 22, color: 'var(--muted)', paddingLeft: 4 }}>Drawn by a kid. Made for you.</div>
          </div>
          <button type="button" className="shop-bag press" onClick={() => navigate('/checkout')}>
            <span>Bag</span>
            <span
              key={bump}
              className="shop-bag-count"
              style={{ background: bagCount ? 'var(--pink)' : '#f1ece4', animation: bump ? 'pop .4s ease' : 'none' }}
            >
              {bagCount}
            </span>
          </button>
        </header>

        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {FILTERS.map((c, i) => {
            const active = c === cat;
            return (
              <button
                key={c}
                type="button"
                className="tab shop-tab"
                aria-pressed={active}
                onClick={() => setCat(c)}
                style={{
                  color: active && c === 'All' ? '#fff' : INK,
                  background: active ? CAT_COLOR[c] : '#fff',
                  boxShadow: active ? `1px 1px 0 ${INK}` : `3px 3px 0 ${INK}`,
                  transform: active ? `rotate(${i % 2 ? 1.5 : -1.5}deg)` : 'none',
                }}
              >
                {c}
              </button>
            );
          })}
          <span className="hand" style={{ fontSize: 20, color: 'var(--faint)', marginLeft: 'auto' }}>hover a drawing to color it in</span>
        </nav>

        <main className="shop-grid">
          {list.map((p, i) => {
            const layer: CSSProperties = { backgroundImage: `url(${bgImage(p.bg)})` };
            return (
              <div
                key={p.name}
                className={'card' + (ALWAYS_COLOR ? ' always' : '')}
                role="button"
                tabIndex={0}
                aria-label={`${p.name}, ${p.price}t`}
                onClick={() => setOpenName(p.name)}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpenName(p.name); } }}
                style={{ '--tilt': `${TILTS[i % 6]}deg`, '--drip': `${DRIP_SECONDS}s` } as CSSProperties}
              >
                <div className="card-layer card-gray" style={layer}><CardArt p={p} /></div>
                <div className="card-layer card-color" style={{ ...layer, WebkitMaskImage: DRIP, maskImage: DRIP }}><CardArt p={p} /></div>
                <div className="card-num">{i + 1}</div>
                <div className="card-label">
                  <span>{p.price}t</span>
                  <span>{p.name}</span>
                </div>
                <button type="button" className="card-add" aria-label={`Add ${p.name} to bag`} onClick={e => { e.stopPropagation(); add(p); }}>+</button>
              </div>
            );
          })}
        </main>

        <footer className="hand" style={{ display: 'flex', justifyContent: 'center', fontSize: 22, color: 'var(--faint)', paddingTop: 12 }}>
          Every piece starts as a drawing.
        </footer>
      </div>

      {open && <ProductModal key={open.name} p={open} num={all.indexOf(open) + 1} onClose={closeModal} />}
    </div>
  );
}
