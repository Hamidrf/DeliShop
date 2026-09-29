import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StudioHeader } from '../components/StudioHeader';
import { Thumb } from '../components/Thumb';
import type { Product } from '../lib/products';
import { deleteProduct, useCatalog } from '../lib/store';
import { CAT_COLOR, FILTERS, INK, colorOf, type CategoryFilter } from '../lib/theme';
import './Inventory.css';

export default function Inventory() {
  const all = useCatalog('studio');
  const [cat, setCat] = useState<CategoryFilter>('All');
  const [pending, setPending] = useState<Product | null>(null);
  const list = all.filter(p => cat === 'All' || p.cat === cat);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPending(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  const confirm = () => {
    if (pending) void deleteProduct(pending).catch(() => {});
    setPending(null);
  };

  return (
    <div className="page">
      <div className="page-inner inv">
        <StudioHeader links={[{ to: '/studio', label: '+ New product' }, { to: '/studio/orders', label: 'Orders' }, { to: '/', label: 'View shop →' }]} />

        <div className="inv-bar">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 className="inv-title">All products</h1>
            <span className="hand" style={{ fontSize: 24, color: 'var(--faint)' }}>
              {all.length} {all.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FILTERS.map(k => {
              const on = k === cat;
              return (
                <button
                  key={k}
                  type="button"
                  className="tab inv-tab"
                  aria-pressed={on}
                  onClick={() => setCat(k)}
                  style={{
                    color: on && k === 'All' ? '#fff' : INK,
                    background: on ? CAT_COLOR[k] : '#fff',
                    boxShadow: on ? `1px 1px 0 ${INK}` : `3px 3px 0 ${INK}`,
                  }}
                >
                  <span>{k}</span>
                  <span style={{ fontSize: 14, opacity: .7 }}>
                    {k === 'All' ? all.length : all.filter(p => p.cat === k).length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {list.length === 0 && <p className="hand" style={{ margin: 0, fontSize: 24, color: 'var(--faint)' }}>No products here.</p>}

        <main className="inv-grid">
          {list.map(p => (
            <div key={(p.custom ? 'c' : 'b') + (p.id ?? p.name)} className="inv-card">
              <div className="inv-card-art" style={{ background: colorOf(p.bg) }}>
                <Thumb p={p} box={130} alt={p.name} filtered />
                {p.custom && <span className="inv-new">New</span>}
              </div>
              <div className="inv-card-body">
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="inv-name">{p.name}</span>
                  <span className="hand" style={{ fontSize: 20, color: 'var(--muted)' }}>{p.cat} · {p.price}t</span>
                </div>
                <Link to={`/studio/edit/${p.id}`} className="inv-edit" aria-label={`Edit ${p.name}`}>Edit</Link>
                <button type="button" className="del-btn inv-del" aria-label={`Delete ${p.name}`} onClick={() => setPending(p)}>Delete</button>
              </div>
            </div>
          ))}
        </main>
      </div>

      {pending && (
        <div className="overlay inv-overlay" onClick={() => setPending(null)}>
          <div
            className="inv-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="inv-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="inv-bang">!</div>
            <span id="inv-dialog-title" className="inv-dialog-title">Delete {pending.name}?</span>
            <div className="inv-dialog-art" style={{ background: colorOf(pending.bg) }}>
              <Thumb p={pending} box={90} filtered />
            </div>
            <span className="hand inv-dialog-text">It will be removed from the shop and from every bag. This can't be undone.</span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 6 }}>
              <button type="button" className="inv-dialog-btn" autoFocus onClick={() => setPending(null)}>Keep it</button>
              <button type="button" className="inv-dialog-btn press" style={{ background: 'var(--red)', color: '#fff' }} onClick={confirm}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
