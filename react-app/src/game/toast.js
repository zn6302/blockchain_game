/* 獨立的 toast 小型 store（跟主要 engine 節流分開，因為它有自己的 show/hide 計時） */
let listeners = new Set();
let snapshot = { msg: "", kind: "", on: false, seq: 0 };
let timer = null;

export function getToastSnapshot() { return snapshot; }
export function subscribeToast(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { listeners.forEach(cb => cb()); }

export function toast(msg, kind, ms) {
  clearTimeout(timer);
  snapshot = { msg, kind: kind || "", on: true, seq: snapshot.seq + 1 };
  emit();
  timer = setTimeout(() => {
    snapshot = { ...snapshot, on: false };
    emit();
  }, ms || 4200);
}
