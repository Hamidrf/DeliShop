import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Thumb } from '../components/Thumb';
import { ApiError, api } from '../lib/api';
import { toLatinDigits } from '../lib/phone';
import type { Product } from '../lib/products';
import { KEYS, changeBagQty, remove, useCatalog, useStored, type BagEntry } from '../lib/store';
import { CARD_HOLDER, CARD_NUMBER, colorOf } from '../lib/theme';
import './Checkout.css';

interface DisplayItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  product: Product;
}

export default function Checkout() {
  const bagEntries = useStored<BagEntry>(KEYS.bag);
  const catalog = useCatalog('shop');
  const byId = new Map(catalog.map(p => [p.id, p]));
  const bag: DisplayItem[] = bagEntries
    .map(b => {
      const product = byId.get(b.productId);
      return product ? { productId: b.productId, name: product.name, price: product.price, qty: b.qty, product } : null;
    })
    .filter((x): x is DisplayItem => x !== null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // once paid, the bag is emptied but the invoice keeps showing what was bought
  const [paid, setPaid] = useState<{ items: DisplayItem[]; number: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const done = paid !== null;
  const items = paid?.items ?? bag;
  const total = items.reduce((n, b) => n + b.price * b.qty, 0);

  const pickReceipt = (f?: File) => {
    if (!f) return;
    setReceipt(f);
    setReceiptPreview(URL.createObjectURL(f));
    setError('');
  };

  const copy = () => {
    navigator.clipboard?.writeText(CARD_NUMBER.replace(/\s/g, '')).catch(() => {});
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const miss: string[] = [];
    if (!bag.length) miss.push('something in your bag');
    if (!name.trim()) miss.push('your name');
    if (phone.replace(/\D/g, '').length < 10) miss.push('a phone number');
    if (!receipt) miss.push('the receipt');
    if (miss.length) { setError('We still need ' + miss.join(', ') + '.'); return; }

    const form = new FormData();
    form.set('name', name.trim());
    form.set('phone', phone);
    form.set('items', JSON.stringify(bag.map(b => ({ productId: b.productId, quantity: b.qty }))));
    form.set('receipt', receipt!);

    setSubmitting(true);
    try {
      const res = await api.postForm<{ number: number; total: number; status: string }>('/orders', form);
      setPaid({ items: bag, number: res.number });
      remove(KEYS.bag);
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'product_unavailable') {
        setError('Some items in your bag were removed from the shop. Please refresh and try again.');
      } else if (err instanceof ApiError && err.code === 'rate_limited') {
        setError('Too many orders from here right now. Please try again later.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not send the order. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-inner co">
        <header className="page-header">
          <Logo to="/" />
          <Link to="/" className="pill">← Keep shopping</Link>
        </header>

        <div className="co-row">
          <div className="co-invoice">
            <div className="co-scallop" />
            <div className="co-paper">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 40, lineHeight: 1 }}>Invoice</span>
                  <span className="hand co-muted">No. {done ? paid.number : '—'}</span>
                </div>
                <span className="hand co-muted" style={{ paddingTop: 6 }}>
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div className="co-rule" />

              {!items.length && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0', textAlign: 'center' }}>
                  <span className="hand" style={{ fontSize: 26 }}>Your bag is empty.</span>
                  <Link to="/" style={{ fontSize: 18 }}>Pick something cute →</Link>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {items.map((b, i) => (
                  <div key={b.productId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="co-thumb" style={{ background: colorOf(b.product.bg), transform: `rotate(${[-4, 3, -2, 4][i % 4]}deg)` }}>
                      <Thumb p={b.product} box={50} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="hand co-line-name">{b.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button type="button" className="co-qty" aria-label={`One less ${b.name}`} disabled={done} onClick={() => changeBagQty(b.productId, -1)}>−</button>
                        <span style={{ minWidth: 22, textAlign: 'center', fontSize: 17 }}>{b.qty}</span>
                        <button type="button" className="co-qty" aria-label={`One more ${b.name}`} disabled={done} onClick={() => changeBagQty(b.productId, 1)}>+</button>
                      </div>
                    </div>
                    <span className="hand" style={{ fontSize: 24, whiteSpace: 'nowrap' }}>{b.price * b.qty}t</span>
                  </div>
                ))}
              </div>

              <div className="co-rule" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                <span style={{ fontSize: 22 }}>Total</span>
                <span className="co-total">
                  <span className="co-highlight" />
                  <span style={{ position: 'relative' }}>{total}t</span>
                </span>
              </div>

              <div style={{ paddingTop: 6 }}>
                <span className="hand co-muted">Thank you for supporting a little artist!</span>
              </div>
            </div>
            <div className="co-scallop" style={{ transform: 'scaleY(-1)' }} />

            {done && <div className="co-stamp">PAID<span className="hand">thank you!</span></div>}
          </div>

          {!done ? (
            <form className="form-card co-form" onSubmit={submit} noValidate>
              <div className="co-step">
                <div className="co-step-head">
                  <span className="co-step-num" style={{ background: 'var(--pink)' }}>1</span>
                  <span>Who is it for?</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                  <label className="co-label">
                    <span>Name</span>
                    <input className="field co-input" value={name} onChange={e => setName(e.target.value)} placeholder="Sara" autoComplete="name" />
                  </label>
                  <label className="co-label">
                    <span>Phone</span>
                    <input
                      className="field co-input"
                      value={phone}
                      onChange={e => setPhone(toLatinDigits(e.target.value).replace(/[^\d\s+]/g, ''))}
                      type="tel"
                      inputMode="tel"
                      placeholder="0912 345 6789"
                      autoComplete="tel"
                      style={{ letterSpacing: .5 }}
                    />
                  </label>
                </div>
              </div>

              <div className="co-step">
                <div className="co-step-head">
                  <span className="co-step-num" style={{ background: 'var(--yellow)' }}>2</span>
                  <span>Send {total}t to this card</span>
                </div>
                <div className="co-card">
                  <div className="co-dot" style={{ right: -40, top: -50, width: 120, height: 120, background: 'var(--yellow)' }} />
                  <div className="co-dot" style={{ right: 62, top: -22, width: 52, height: 52, background: 'var(--pink)' }} />
                  <div className="co-chip" />
                  <span className="co-card-number">{CARD_NUMBER}</span>
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="hand" style={{ fontSize: 22 }}>{CARD_HOLDER}</span>
                    <button type="button" className="co-copy" onClick={copy}>{copied ? 'Copied ✓' : 'Copy number'}</button>
                  </div>
                </div>
              </div>

              <div className="co-step">
                <div className="co-step-head">
                  <span className="co-step-num" style={{ background: 'var(--purple)' }}>3</span>
                  <span>Upload the receipt</span>
                </div>
                <div
                  className="dropzone"
                  role="button"
                  tabIndex={0}
                  style={{ minHeight: 150 }}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); pickReceipt(e.dataTransfer.files[0]); }}
                >
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 260, display: 'block', padding: 10 }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', padding: 16 }}>
                      <span style={{ fontSize: 36, lineHeight: 1 }}>↑</span>
                      <span className="hand co-muted">Drop a screenshot of your payment</span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { pickReceipt(e.target.files?.[0]); e.target.value = ''; }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button type="submit" className="btn-dark co-submit press press-pink" disabled={submitting}>{submitting ? 'Sending…' : 'Send my order'}</button>
                <span className="hand" role="alert" style={{ fontSize: 21, color: '#C8283F', textAlign: 'center' }}>{error}</span>
              </div>
            </form>
          ) : (
            <div className="co-thanks">
              <span style={{ fontWeight: 800, fontSize: 44, lineHeight: 1.05 }}>Yay, thank you {name.trim().split(' ')[0]}!</span>
              <span className="hand" style={{ fontSize: 26, lineHeight: 1.3, textWrap: 'pretty' }}>
                We got your order. Once we check the payment, we'll pack it up and send it to you. We'll call {phone} if we need anything.
              </span>
              <Link to="/" className="pill" style={{ height: 54, padding: '0 26px', fontSize: 19 }}>Back to the shop</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
