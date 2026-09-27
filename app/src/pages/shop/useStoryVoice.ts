import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays a product's recorded voice, or reads its story aloud with the
 * browser's speech synthesis when there's no recording. Progress is 0..1.
 */
export function useStoryVoice(text: string, voice: string | null) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const tick = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    if (audio.current) { audio.current.pause(); audio.current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    clearInterval(tick.current);
  }, []);

  useEffect(() => stop, [stop]);

  const toggle = () => {
    if (playing) { stop(); setPlaying(false); return; }
    stop();
    const done = () => { clearInterval(tick.current); setPlaying(false); setProgress(1); };
    if (voice) {
      const a = new Audio(voice);
      audio.current = a;
      a.ontimeupdate = () => setProgress(a.currentTime / (a.duration || 1));
      a.onended = done;
      a.play().catch(done);
    } else if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 1.45;
      // boundary events are patchy across browsers, so also creep forward on a timer
      const est = text.length * 65, t0 = Date.now();
      u.onboundary = e => setProgress(p => Math.max(p, e.charIndex / text.length));
      tick.current = window.setInterval(() => setProgress(p => Math.max(p, Math.min(.97, (Date.now() - t0) / est))), 250);
      u.onend = done;
      speechSynthesis.speak(u);
    } else {
      return;
    }
    setPlaying(true);
    setProgress(0);
  };

  return { playing, progress, toggle };
}
