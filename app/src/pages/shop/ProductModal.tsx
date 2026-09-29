import { useEffect, useState, type CSSProperties } from 'react';
import { cropStyle, type Product } from '../../lib/products';
import { addToBag } from '../../lib/store';
import { INK, bgImage, colorOf } from '../../lib/theme';
import { BAG, CHAIN, EAR_V2, HOOK } from './holderArt';
import { useStoryVoice } from './useStoryVoice';

const Svg = ({ html, style }: { html: string; style: CSSProperties }) =>
  <div style={style} dangerouslySetInnerHTML={{ __html: html }} />;

/** The product itself: its real photo, or the coloured drawing until one exists. */
function Art({ p, size }: { p: Product; size: number }) {
  if (p.real) {
    return <img src={p.real} alt={p.name} style={{ width: size, display: 'block', filter: 'drop-shadow(5px 7px 0 rgba(29,27,25,.28))' }} />;
  }
  const ar = p.w / p.h;
  return (
    <div className="crop" style={{ width: ar >= 0.8 ? size : size * 1.25 * ar, aspectRatio: String(ar), borderRadius: 18 }}>
      <img
        src={p.src}
        alt={p.name}
        style={{ ...cropStyle(p), mixBlendMode: 'multiply', filter: p.photo ? 'contrast(1.35) brightness(1.12) saturate(1.2)' : 'contrast(1.3) brightness(1.08)' }}
      />
    </div>
  );
}

/** Swipeable gallery of a product's real photos, shown when there's more than one. */
function PhotoSlider({ photos }: { photos: string[] }) {
  const [i, setI] = useState(0);
  if (photos.length <= 1) return null;
  const prev = () => setI(v => (v - 1 + photos.length) % photos.length);
  const next = () => setI(v => (v + 1) % photos.length);
  return (
    <div className="pm-slider">
      <button type="button" className="pm-slider-arrow" aria-label="Previous photo" onClick={prev}>‹</button>
      <img src={photos[i]} alt="" className="pm-slider-img" />
      <button type="button" className="pm-slider-arrow" aria-label="Next photo" onClick={next}>›</button>
      <div className="pm-slider-dots">
        {photos.map((_, idx) => (
          <button
            key={idx}
            type="button"
            className="pm-slider-dot"
            aria-label={`Photo ${idx + 1} of ${photos.length}`}
            aria-current={idx === i}
            onClick={() => setI(idx)}
            style={{ background: idx === i ? INK : '#fff' }}
          />
        ))}
      </div>
    </div>
  );
}

/** Animated scene: keychains swing from a hand, earrings sway from an ear, pins drop onto a backpack. */
function Stage({ p }: { p: Product }) {
  if (p.cat !== 'Earrings' && p.cat !== 'Pins') {
    // hand.png is 471px wide; its ring sits at (231, 240) before scaling
    const HW = 320, s = HW / 471, ox = -18 * s, rx = ox + 231 * s, ry = 240 * s;
    return (
      <div style={{ position: 'absolute', left: 0, top: 20, width: 260, height: 520, animation: 'handSide .8s cubic-bezier(.3,1.3,.5,1) both' }}>
        <div style={{ position: 'absolute', left: rx - 110, width: 220, top: ry - 10, transformOrigin: '50% 0', animation: 'swing 2.8s ease-in-out infinite', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Svg html={CHAIN} style={{ width: 26 }} />
          {/* real photos carry transparent padding on top, so pull them up to the last link */}
          <div style={{ marginTop: p.real ? -24 : -4 }}><Art p={p} size={220} /></div>
        </div>
        <img src="/assets/hand.png" alt="" style={{ position: 'absolute', left: ox, top: 0, width: HW, display: 'block', zIndex: 2, pointerEvents: 'none' }} />
      </div>
    );
  }
  if (p.cat === 'Earrings') {
    const s = 230 / 240, hx = 112 * s, hy = 256 * s;
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: 230, height: 560, animation: 'handSide .8s cubic-bezier(.3,1.3,.5,1) both' }}>
        <Svg html={EAR_V2} style={{ position: 'absolute', left: 0, top: 0, width: 230 }} />
        <div style={{ position: 'absolute', left: hx - 75, width: 150, top: hy - 4, transformOrigin: '50% 0', animation: 'dangle 1.9s ease-in-out infinite', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
          <Svg html={HOOK} style={{ width: 20 }} />
          <div style={{ marginTop: -6 }}><Art p={p} size={150} /></div>
        </div>
      </div>
    );
  }
  const badge = p.real ? <Art p={p} size={210} /> : (
    <div style={{ position: 'relative', width: 210, height: 210, borderRadius: '50%', border: `6px solid ${INK}`, background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 0 rgba(29,27,25,.25), inset 0 0 0 8px #f3eee6' }}>
      <Art p={p} size={150} />
      <div style={{ position: 'absolute', top: '-20%', bottom: '-20%', width: '35%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)', animation: 'shine 3.2s ease-in-out infinite' }} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, animation: 'fadeIn .4s both' }}>
      <Svg html={BAG} style={{ position: 'absolute', left: '50%', bottom: -120, width: 340, marginLeft: -170, animation: 'palmIn .7s cubic-bezier(.3,1.3,.5,1) both' }} />
      <div style={{ position: 'absolute', left: '50%', top: 170, marginLeft: -105, animation: 'pinDrop .9s .45s cubic-bezier(.3,1.2,.5,1) both' }}>
        <div style={{ animation: 'tilt 3s 1.4s ease-in-out infinite' }}>{badge}</div>
      </div>
    </div>
  );
}

export function ProductModal({ p, num, onClose }: { p: Product; num: number; onClose: () => void }) {
  const { playing, progress, toggle } = useStoryVoice(p.story, p.voice);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const color = colorOf(p.bg);
  return (
    <div className="overlay pm-overlay" onClick={onClose}>
      <div
        className="pm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-title"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: color, backgroundImage: `url(${bgImage(p.bg)})` }}
      >
        <button type="button" className="pm-close press" aria-label="Close" onClick={onClose}>✕</button>

        <div className="pm-stage"><Stage p={p} /></div>

        <div className="pm-info">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <span className="pm-num">{num}</span>
            <h2 id="pm-title" className="pm-name">{p.name}</h2>
          </div>

          <PhotoSlider photos={p.photos} />

          <div className="pm-bubble">
            <p className="hand pm-story">{p.story}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                className="pm-play"
                aria-label={playing ? 'Pause story' : 'Play story'}
                onClick={toggle}
                style={{ background: color, padding: `0 0 0 ${playing ? '0' : '4px'}` }}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 16 }}>{playing ? 'Listening…' : progress >= 1 ? 'Play again' : 'Listen to the story'}</span>
                <div className="pm-track">
                  <div className="pm-fill" style={{ width: Math.round(progress * 100) + '%' }} />
                </div>
              </div>
              <div className="pm-eq" aria-hidden="true">
                {[0, .2, .4, .1, .3].map((d, i) => (
                  <span key={i} style={{ animation: playing ? `eq .7s ease-in-out ${d}s infinite` : 'none' }} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 6 }}>
            <span className="pm-price">{p.price}t</span>
            <button type="button" className="btn-dark pm-add press press-light" onClick={() => { addToBag(p); setAdded(true); }}>
              {added ? 'Added ✓' : 'Add to bag'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
