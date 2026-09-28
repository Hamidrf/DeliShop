import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { StudioHeader } from '../components/StudioHeader';
import { ApiError, api } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { useCatalog } from '../lib/store';
import { CATEGORIES, CAT_COLOR, COLORS, INK, bgImage, colorOf, type BgKey, type Category } from '../lib/theme';
import './Admin.css';

interface Img { blob: Blob; url: string; w: number; h: number }

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
  const shopCount = useCatalog('shop').length;

  const [name, setName] = useState('');
  const [cat, setCat] = useState<Category>('Keychains');
  const [bg, setBg] = useState<BgKey>('pink');
  const [drawing, setDrawing] = useState<Img | null>(null);
  const [photo, setPhoto] = useState<Img | null>(null);
  const [price, setPrice] = useState('');
  const [story, setStory] = useState('');
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

  const pickDrawing = async (f?: File) => { if (f) { setDrawing(await fileToImage(f, 1000, 'image/png')); setMsg({ text: '', ok: true }); } };
  const pickPhoto = async (f?: File) => { if (f) { setPhoto(await fileToImage(f, 800, 'image/png')); setMsg({ text: '', ok: true }); } };
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
    const missing = [!name.trim() && 'name', !drawing && 'drawing', !(Number(price) > 0) && 'price'].filter(Boolean);
    if (missing.length || !drawing) { setMsg({ text: 'Missing: ' + missing.join(', '), ok: false }); return; }

    const form = new FormData();
    form.set('name', name.trim());
    form.set('category', cat);
    form.set('color', bg);
    form.set('price', price);
    form.set('story', story.trim());
    form.set('drawing', drawing.blob, 'drawing.png');
    if (photo) form.set('photo', photo.blob, 'photo.png');
    if (voice) form.set('voice', voice.blob, 'voice.webm');

    setSaving(true);
    try {
      const { product } = await api.postForm<{ product: { name: string } }>('/studio/products', form);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['studio', 'products'] });
      setName(''); setCat('Keychains'); setBg('pink'); setDrawing(null); setPhoto(null); setPrice(''); setStory(''); setVoice(null);
      setMsg({ text: product.name + ' is in the shop!', ok: true });
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Could not save. Try again.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const drop = (fn: (f?: File) => void) => (e: DragEvent) => { e.preventDefault(); fn(e.dataTransfer.files[0]); };
  const mm = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');

  return (
    <div className="page">
      <div className="page-inner adm">
        <StudioHeader links={[{ to: '/studio/products', label: 'All products' }, { to: '/studio/orders', label: 'Orders' }, { to: '/', label: 'View shop →' }]} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <form className="form-card adm-form" onSubmit={save} noValidate>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1 }}>New product</h1>

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
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
                  onDrop={drop(pickDrawing)}
                >
                  {drawing ? <img src={drawing.url} alt="Drawing" className="adm-drop-img" /> : (
                    <div className="adm-drop-empty">
                      <span style={{ fontSize: 40, lineHeight: 1 }}>✎</span>
                      <span className="hand">Drop the kid's drawing</span>
                    </div>
                  )}
                </div>
                <input ref={drawRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { pickDrawing(e.target.files?.[0]); e.target.value = ''; }} />
              </div>

              <div className="adm-field">
                <span>Product photo</span>
                <div
                  className="dropzone adm-drop"
                  role="button"
                  tabIndex={0}
                  aria-label="Choose the product photo"
                  onClick={() => photoRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoRef.current?.click(); } }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={drop(pickPhoto)}
                >
                  {photo ? <img src={photo.url} alt="Product photo" className="adm-drop-img" /> : (
                    <div className="adm-drop-empty">
                      <span style={{ fontSize: 40, lineHeight: 1 }}>◎</span>
                      <span className="hand">Drop a photo, no background</span>
                    </div>
                  )}
                </div>
                <input ref={photoRef} type="file" accept="image/png,image/webp,image/*" style={{ display: 'none' }} onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
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
                  <span style={{ whiteSpace: 'pre' }}>{recording ? 'Stop  ' + mm : voice ? 'Record again' : 'Record'}</span>
                </button>
                <button type="button" className="adm-btn" onClick={() => voiceRef.current?.click()}>Upload audio</button>
                <input ref={voiceRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { pickVoice(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              {voice && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <audio controls src={voice.url} style={{ flex: 1, minWidth: 220, height: 44 }} />
                  <button type="button" className="adm-remove" onClick={() => setVoice(null)}>Remove</button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
              <button type="submit" className="btn-dark adm-submit press press-pink" disabled={saving}>{saving ? 'Saving…' : 'Add to shop'}</button>
              <span className="hand" role="status" style={{ fontSize: 22, color: msg.ok ? '#2E8B57' : '#C8283F' }}>{msg.text}</span>
            </div>
          </form>

          <aside className="adm-aside">
            <span className="hand" style={{ fontSize: 22, color: 'var(--faint)' }}>Preview</span>
            <div className="adm-preview" style={{ backgroundColor: colorOf(bg), backgroundImage: `url(${bgImage(bg)})` }}>
              <div className="adm-preview-art">
                {drawing && <img src={drawing.url} alt="" />}
              </div>
              <div className="card-num">{shopCount + 1}</div>
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
