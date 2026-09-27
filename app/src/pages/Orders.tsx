import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StudioHeader } from '../components/StudioHeader';
import { api } from '../lib/api';
import { INK } from '../lib/theme';

type OrderStatus = 'awaiting_review' | 'confirmed' | 'shipped' | 'rejected' | 'cancelled';

interface OrderSummary {
  id: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  total: number;
  adminNote: string | null;
  createdAt: string;
  items: { productId: string | null; productName: string; unitPrice: number; quantity: number }[];
  receiptUrl: string;
}

const STATUS_FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_review', label: 'Awaiting review' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_review: ['confirmed', 'rejected'],
  confirmed: ['shipped', 'cancelled'],
  shipped: [],
  rejected: [],
  cancelled: [],
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  awaiting_review: 'var(--yellow)',
  confirmed: 'var(--mint)',
  shipped: 'var(--green)',
  rejected: 'var(--red)',
  cancelled: '#ddd',
};

function OrderDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data } = useQuery({
    queryKey: ['studio', 'orders', 'detail', id],
    queryFn: () => api.get<{ order: OrderDetail }>(`/studio/orders/${id}`).then(r => r.order),
  });

  if (!data) return null;
  const noteValue = note ?? data.adminNote ?? '';

  const setStatus = async (status: OrderStatus) => {
    setBusy(true);
    setErr('');
    try {
      await api.patch(`/studio/orders/${id}`, { status });
      await queryClient.invalidateQueries({ queryKey: ['studio', 'orders'] });
    } catch {
      setErr("Couldn't update the status. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.patch(`/studio/orders/${id}`, { adminNote: noteValue });
      await queryClient.invalidateQueries({ queryKey: ['studio', 'orders'] });
    } catch {
      setErr("Couldn't save the note. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        className="form-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', gap: 16 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Order #{data.number}</h2>
            <span className="hand" style={{ fontSize: 18, color: 'var(--muted)' }}>{new Date(data.createdAt).toLocaleString()}</span>
          </div>
          <button type="button" className="del-btn" style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${INK}` }} onClick={onClose}>✕</button>
        </div>

        <span className="tab" style={{ alignSelf: 'flex-start', padding: '4px 14px', background: STATUS_COLOR[data.status] }}>{data.status}</span>

        <div>
          <div><strong>{data.customerName}</strong> · {data.customerPhone}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17 }}>
              <span>{item.productName} × {item.quantity}</span>
              <span>{item.unitPrice * item.quantity}t</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 20, borderTop: `2px solid ${INK}`, paddingTop: 8 }}>
            <span>Total</span>
            <span>{data.total}t</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: 15, color: 'var(--muted)' }}>Receipt</span>
          <a href={data.receiptUrl} target="_blank" rel="noreferrer">
            <img src={data.receiptUrl} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 12, border: `2px solid ${INK}`, display: 'block', marginTop: 6 }} />
          </a>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15, color: 'var(--muted)' }}>Admin note</span>
          <textarea className="field" rows={3} style={{ padding: 10, borderRadius: 12 }} value={noteValue} onChange={e => setNote(e.target.value)} />
          <button type="button" className="btn-dark" style={{ alignSelf: 'flex-start', height: 38, padding: '0 16px', fontSize: 15 }} disabled={busy} onClick={saveNote}>Save note</button>
        </label>

        {ALLOWED_TRANSITIONS[data.status].length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ALLOWED_TRANSITIONS[data.status].map(next => (
              <button
                key={next}
                type="button"
                className="btn-dark press"
                style={{ height: 44, padding: '0 18px', fontSize: 16 }}
                disabled={busy}
                onClick={() => setStatus(next)}
              >
                Mark {next.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
        {err && <span className="hand" style={{ color: '#C8283F', fontSize: 18 }}>{err}</span>}
      </div>
    </div>
  );
}

export default function Orders() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['studio', 'orders', status],
    queryFn: () => api.get<{ orders: OrderSummary[]; nextCursor: string | null }>(
      `/studio/orders${status === 'all' ? '' : `?status=${status}`}`,
    ),
  });
  const orders = data?.orders ?? [];

  return (
    <div className="page">
      <div className="page-inner inv">
        <StudioHeader links={[{ to: '/studio', label: '+ New product' }, { to: '/studio/products', label: 'All products' }, { to: '/', label: 'View shop →' }]} />

        <div className="inv-bar">
          <h1 className="inv-title">Orders</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                className="tab"
                aria-pressed={status === f.key}
                onClick={() => setStatus(f.key)}
                style={{
                  height: 40, padding: '0 14px', fontSize: 15,
                  background: status === f.key ? 'var(--yellow)' : '#fff',
                  boxShadow: status === f.key ? `1px 1px 0 ${INK}` : `3px 3px 0 ${INK}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {orders.length === 0 && <p className="hand" style={{ fontSize: 22, color: 'var(--faint)' }}>No orders here.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(o => (
            <button
              key={o.id}
              type="button"
              className="inv-card"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', textAlign: 'left', border: `2.5px solid ${INK}` }}
              onClick={() => setOpenId(o.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 20 }}>#{o.number}</span>
                <span>{o.customerName} · {o.customerPhone}</span>
                <span className="hand" style={{ color: 'var(--muted)' }}>{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="tab" style={{ padding: '4px 12px', fontSize: 14, background: STATUS_COLOR[o.status] }}>{o.status}</span>
                <span style={{ fontWeight: 800 }}>{o.total}t</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {openId && <OrderDetailPanel id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
