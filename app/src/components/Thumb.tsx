import { artFilter, cropStyle, type Crop } from '../lib/products';

type ThumbSource = Omit<Crop, 'photo'> & { real: string | null; photo?: boolean };

/**
 * A product picture fitted into a `box`-pixel square: the real photo when
 * there is one, otherwise the crop of the drawing.
 */
export function Thumb({ p, box, alt = '', filtered = false }: { p: ThumbSource; box: number; alt?: string; filtered?: boolean }) {
  if (p.real) {
    return (
      <div className="crop" style={{ width: box, height: box }}>
        <img src={p.real} alt={alt} style={{ width: '100%', left: '0%', top: '0%' }} />
      </div>
    );
  }
  const ar = p.w / p.h;
  return (
    <div className="crop" style={{ width: ar >= 1 ? box : box * ar, height: ar >= 1 ? box / ar : box }}>
      <img
        src={p.src}
        alt={alt}
        style={{ ...cropStyle(p), mixBlendMode: 'multiply', filter: filtered ? artFilter({ src: p.src, photo: !!p.photo }) : undefined }}
      />
    </div>
  );
}
