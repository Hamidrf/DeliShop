import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StudioHeader } from '../components/StudioHeader';
import { ApiError, api } from '../lib/api';
import type { Product } from '../lib/products';
import { queryClient } from '../lib/queryClient';
import { useCatalog } from '../lib/store';
import { CATEGORIES, CAT_COLOR, COLORS, INK, bgImage, colorOf, type BgKey, type Category } from '../lib/theme';
import './Admin.css';

const MAX_PHOTOS = 6;

interface Img { blob: Blob; url: string; w: number; h: number }
/** An existing photo, already on the product, kept unless the studio user removes it. */
interface ExistingPhoto { key: string; url: string }

/** Loads an image file, shrinks it to fit `max` px and re-encodes it as a Blob. */
function fileToImage(file: File, max: number, type: 'image/jpeg' | 'image/png') {
  return new Promise<Img>((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d')!;
        // JPEG has no alpha channel, so a transparent source must be flattened
        // onto white first or the canvas's default black shows through instead.
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(blob => {
          if (!blob) { rej(new Error('Could not read that image.')); return; }
          res({ blob, url: URL.createObjectURL(blob), w, h });
        }, type, 0.86);
      };
      img.onerror = rej;
      img.src = r.result as string;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function Admin() {
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shop = useCatalog('shop');
  const studio = useCatalog('studio');
  const editing = studio.find(p => p.id === editId);

  if (editId && studio.length && !editing) {
    // Bad or archived id (studio catalog loaded, product not in it).
    navigate('/studio/products', { replace: true });
    return null;
  }
  if (editId && !editing) {
    // Studio catalog for the edit form hasn't loaded yet.
    return (
      <div className="page"><div className="page-inner adm">
        <StudioHeader links={[{ to: '/studio/products', label: 'All products' }, { to: '/studio/orders', label: 'Orders' }, { to: '/', label: 'View shop →' }]} />
        <span className="hand" style={{ fontSize: 24, color: 'var(--faint)' }}>Loading…</span>
      </div></div>
    );
  }

  return <AdminForm key={editId ?? 'new'} shopCount={shop.length} editing={editing} />;
}

function AdminForm({ shopCount, editing }: { shopCount: number; editing: Product | undefined }) {
  const navigate = useNavigate();
  const isEdit = !!editing;

  const [name, setName] = useState(editing?.name ?? '');
  const [cat, setCat] = useState<Category>(editing?.cat ?? 'Keychains');
  const [bg, setBg] = useState<BgKey>(editing?.bg ?? 'pink');
  const [drawingPreview] = useState<string | null>(editing?.src ?? null);
  const [newDrawing, setNewDrawing] = useState<Img | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(
    editing ? editing.photoKeys.map((key, i) => ({ key, url: editing.photos[i] })) : [],
  );
  const [newPhotos, setNewPhotos] = useState<Img[]>([]);
  const [price, setPrice] = useState(editing ? String(editing.price) : '');
  const [story, setStory] = useState(editing?.story ?? '');
  const [existingVoiceUrl, setExistingVoiceUrl] = useState<string | null>(editing?.voice ?? null);
  const [voice, setVoice] = useState<{ blob: Blob; url: string } | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: '', ok: true });
  const [saving, setSaving] = useState(false);

  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const drawRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);

  const stopRec = () => {
    clearInterval(timer.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null;
    setRecording(false);
  };
  useEffect(() => stopRec, []);

  const photoCount = existingPhotos.length + newPhotos.length;

  const pickDrawing = async (f?: File) => { if (f) { setNewDrawing(await fileToImage(f, 1000, 'image/png')); setMsg({ text: '', ok: true }); } };
  const pickPhotos = async (files: FileList | File[] | undefined) => {
    if (!files || !files.length) return;
    const room = MAX_PHOTOS - photoCount;
    if (room <= 0) { setMsg({ text: `Up to ${MAX_PHOTOS} photos per product.`, ok: false }); return; }
    const picked = await Promise.all(Array.from(files).slice(0, room).map(f => fileToImage(f, 800, 'image/png')));
    setNewPhotos(p => [...p, ...picked]);
    setMsg({ text: '', ok: true });
  };
  const removeExistingPhoto = (key: string) => setExistingPhotos(p => p.filter(x => x.key !== key));
  const removeNewPhoto = (url: string) => setNewPhotos(p => p.filter(x => x.url !== url));
  const pickVoice = (f?: File) => { if (f) { setVoice({ blob: f, url: URL.createObjectURL(f) }); setMsg({ text: '', ok: true }); } };

  const toggleRecord = async () => {
    if (recording) { stopRec(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        setVoice({ blob, url: URL.createObjectURL(blob) });
      };
      rec.start();
      recorder.current = rec;
      timer.current = window.setInterval(() => setSecs(s => s + 1), 1000);
      setSecs(0);
      setRecording(true);
    } catch {
      setMsg({ text: 'Microphone is not available.', ok: false });
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const missing = [!name.trim() && 'name', !(isEdit || newDrawing) && 'drawing', !(Number(price) > 0) && 'price'].filter(Boolean);
    if (missing.length) { setMsg({ text: 'Missing: ' + missing.join(', '), ok: false }); return; }

    const form = new FormData();
    form.set('name', name.trim());
    form.set('category', cat);
    form.set('color', bg);
    form.set('price', price);
    form.set('story', story.trim());
    if (newDrawing) form.set('drawing', newDrawing.blob, 'drawing.png');
    for (const p of newPhotos) form.append('photos[]', p.blob, 'photo.png');
    if (isEdit) form.set('keepPhotoKeys', JSON.stringify(existingPhotos.map(p => p.key)));
    if (isEdit && !existingVoiceUrl && !voice) form.set('removeVoice', 'true');
    if (voice) form.set('voice', voice.blob, 'voice.webm');

    setSaving(true);
    try {
      const path = isEdit ? `/studio/products/${editing!.id}` : '/studio/products';
      const { product } = await api.postForm<{ product: { name: string } }>(path, form);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['studio', 'products'] });
      if (isEdit) {
        navigate('/studio/products');
        return;
      }
      setName(''); setCat('Keychains'); setBg('pink'); setNewDrawing(null); setNewPhotos([]); setPrice(''); setStory(''); setVoice(null);
      setMsg({ text: product.name + ' is in the shop!', ok: true });
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Could not save. Try again.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const drop = (fn: (f?: FileList) => void) => (e: DragEvent) => { e.preventDefault(); fn(e.dataTransfer.files); };
  const mm = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  const drawingUrl = newDrawing?.url ?? drawingPreview;

  return (
    <div className="page">
      <div className="page-inner adm">
        <StudioHeader links={[{ to: '/studio/products', label: 'All products' }, { to: '/studio/orders', label: 'Orders' }, { to: '/', label: 'View shop →' }]} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <form className="form-card adm-form" onSubmit={save} noValidate>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{isEdit ? 'Edit product' : 'New product'}</h1>

            <label className="adm-field">
              <span>Name</span>
              <input className="field adm-input" value={name} onChange={e => setName(e.target.value)} placeholder="Super Fox" />
            </label>

            <div className="adm-field" role="group" aria-label="Category">
              <span>Category</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {CATEGORIES.map((c, i) => {
                  const on = cat === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      className="tab adm-cat"
                      aria-pressed={on}
                      onClick={() => setCat(c)}
                      style={{
                        background: on ? CAT_COLOR[c] : '#fff',
                        boxShadow: on ? `1px 1px 0 ${INK}` : `3px 3px 0 ${INK}`,
                        transform: on ? `rotate(${i % 2 ? 1.5 : -1.5}deg)` : 'none',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="adm-field" role="group" aria-label="Card color">
              <span>Card color</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {(Object.keys(COLORS) as BgKey[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    className="adm-swatch"
                    aria-label={k}
                    aria-pressed={bg === k}
                    onClick={() => setBg(k)}
                    style={{ background: COLORS[k], boxShadow: bg === k ? `0 0 0 4px #fff, 0 0 0 6.5px ${INK}` : 'none' }}
                  />
                ))}
              </div>
            </div>

            <div className="adm-field">
              <span>Drawing</span>
              <div
                className="dropzone adm-drop"
                role="button"
                tabIndex={0}
                aria-label="Choose the drawing"
                onClick={() => drawRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drawRef.current?.click(); } }}
                onDragOver={e => e.preventDefault()}
                onDrop={drop(files => pickDrawing(files?.[0]))}
              >
                {drawingUrl ? <img src={drawingUrl} alt="Drawing" className="adm-drop-img" /> : (
                  <div className="adm-drop-empty">
                    <span style={{ fontSize: 40, lineHeight: 1 }}>✎</span>
                    <span className="hand">Drop the kid's drawing</span>
                  </div>
                )}
              </div>
              <input ref={drawRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { pickDrawing(e.target.files?.[0]); e.target.value = ''; }} />
            </div>

            <div className="adm-field">
              <span>Product photos {photoCount > 0 && <span style={{ opacity: .6 }}>({photoCount}/{MAX_PHOTOS})</span>}</span>
              {(existingPhotos.length > 0 || newPhotos.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {existingPhotos.map(p => (
                    <div key={p.key} className="adm-row">
                      <div className="adm-row-thumb"><img src={p.url} alt="" /></div>
                      <span className="adm-row-name" style={{ flex: 1 }}>Photo</span>
                      <button type="button" className="adm-row-del" aria-label="Remove this photo" onClick={() => removeExistingPhoto(p.key)}>✕</button>
                    </div>
                  ))}
                  {newPhotos.map(p => (
                    <div key={p.url} className="adm-row">
                      <div className="adm-row-thumb"><img src={p.url} alt="" /></div>
                      <span className="adm-row-name" style={{ flex: 1 }}>New photo</span>
                      <button type="button" className="adm-row-del" aria-label="Remove this photo" onClick={() => removeNewPhoto(p.url)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {photoCount < MAX_PHOTOS && (
                <div
                  className="dropzone adm-drop"
                  role="button"
                  tabIndex={0}
                  aria-label="Add a product photo"
                  onClick={() => photoRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoRef.current?.click(); } }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={drop(pickPhotos)}
                  style={{ aspectRatio: 'auto', minHeight: 120 }}
                >
                  <div className="adm-drop-empty">
                    <span style={{ fontSize: 40, lineHeight: 1 }}>◎</span>
                    <span className="hand">Drop photos, no background — a few at once is fine</span>
                  </div>
                </div>
              )}
              <input ref={photoRef} type="file" accept="image/png,image/webp,image/*" multiple style={{ display: 'none' }} onChange={e => { void pickPhotos(e.target.files ?? undefined); e.target.value = ''; }} />
            </div>

            <label className="adm-field">
              <span>Price</span>
              <div className="adm-price">
                <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="150" />
                <span className="hand" style={{ fontSize: 24 }}>t</span>
              </div>
            </label>

            <label className="adm-field">
              <span>Story</span>
              <textarea
                className="field hand adm-story"
                value={story}
                onChange={e => setStory(e.target.value)}
                rows={4}
                placeholder="This is Super Fox. He wears a black mask…"
              />
            </label>

            <div className="adm-field">
              <span>Voice</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="adm-btn" onClick={toggleRecord} style={{ padding: '0 20px 0 14px', background: recording ? '#FFE0E5' : '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="adm-rec-dot" style={{ borderRadius: recording ? 4 : '50%', animation: recording ? 'blink 1s infinite' : 'none' }} />
                  <span style={{ whiteSpace: 'pre' }}>{recording ? 'Stop  ' + mm : voice || existingVoiceUrl ? 'Record again' : 'Record'}</span>
                </button>
                <button type="button" className="adm-btn" onClick={() => voiceRef.current?.click()}>Upload audio</button>
                <input ref={voiceRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { pickVoice(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              {(voice || existingVoiceUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <audio controls src={voice?.url ?? existingVoiceUrl ?? undefined} style={{ flex: 1, minWidth: 220, height: 44 }} />
                  <button type="button" className="adm-remove" onClick={() => { setVoice(null); setExistingVoiceUrl(null); }}>Remove</button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
              <button type="submit" className="btn-dark adm-submit press press-pink" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to shop'}
              </button>
              <span className="hand" role="status" style={{ fontSize: 22, color: msg.ok ? '#2E8B57' : '#C8283F' }}>{msg.text}</span>
            </div>
          </form>

          <aside className="adm-aside">
            <span className="hand" style={{ fontSize: 22, color: 'var(--faint)' }}>Preview</span>
            <div className="adm-preview" style={{ backgroundColor: colorOf(bg), backgroundImage: `url(${bgImage(bg)})` }}>
              <div className="adm-preview-art">
                {drawingUrl && <img src={drawingUrl} alt="" />}
              </div>
              <div className="card-num">{(isEdit ? shopCount : shopCount + 1)}</div>
              <div className="card-label">
                <span>{price || '0'}t</span>
                <span>{name || 'Name'}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
