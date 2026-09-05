/* ============================ 音效 ============================ */
export const SFX = { on: false, ac: null, last: {} };
export function sfxInit() {
  if (SFX.ac) return;
  try { SFX.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { }
}
export function sfx(kind, vol) {
  if (!SFX.on || !SFX.ac) return;
  const now = SFX.ac.currentTime, gap = { shot: 0.07, hit: 0.07, kill: 0.12, buy: 0.05, sell: 0.05, warn: 0.4, coin: 0.16 }[kind] || 0.08;
  if (SFX.last[kind] && now - SFX.last[kind] < gap) return;
  SFX.last[kind] = now;
  const ac = SFX.ac, g = ac.createGain(), o = ac.createOscillator();
  let f0 = 440, f1 = 440, dur = 0.08, type = "square", v = (vol || 1) * 0.06;
  if (kind === "shot") { f0 = 680; f1 = 420; dur = 0.05; type = "square"; v *= 0.5; }
  if (kind === "hit") { f0 = 240; f1 = 120; dur = 0.07; type = "sawtooth"; }
  if (kind === "kill") { f0 = 180; f1 = 48; dur = 0.26; type = "sawtooth"; v *= 1.5; }
  if (kind === "buy") { f0 = 420; f1 = 760; dur = 0.10; type = "triangle"; }
  if (kind === "sell") { f0 = 760; f1 = 380; dur = 0.14; type = "triangle"; }
  if (kind === "warn") { f0 = 300; f1 = 300; dur = 0.30; type = "sine"; v *= 1.3; }
  if (kind === "coin") { f0 = 980; f1 = 1460; dur = 0.06; type = "triangle"; v *= 0.6; }
  o.type = type; o.frequency.setValueAtTime(f0, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
  g.gain.setValueAtTime(v, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(ac.destination); o.start(now); o.stop(now + dur + 0.02);
}
