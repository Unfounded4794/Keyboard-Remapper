// Narrow wired playback model derived from recovered NIZ FUN_000082f4,
// address 0x82f4. It models when host reports are flushed, independently of
// Keystone's macro decoder. A successful byte readback alone is insufficient.
// https://github.com/cbingb666/niz-firmware/blob/main/recovered/firmware/decompiled/functions/000082f4_FUN_000082f4.c
export function wiredNizPlayback(reports: readonly Uint8Array[]) {
  const head = reports[0];
  if (head[4] !== 2 || head[5] !== 1)
    throw Error("Playback fixture requires one-shot type 2.");
  const payload = reports
    .flatMap((r) => [...r.slice(11)])
    .slice(0, head[9] * 256 + head[10]);
  const held = new Set<number>(),
    frames: { at: number; keys: number[] }[] = [];
  let at = 0;
  const flush = () => frames.push({ at, keys: [...held] });
  for (let i = 0; i < payload.length;) {
    const action = payload[i++];
    let wait = 0;
    if (action === 200) {
      if (i + 2 > payload.length) throw Error("Truncated NIZ delay marker.");
      wait = payload[i++] * 256 + payload[i++];
    } else if (action < 200) {
      held.has(action) ? held.delete(action) : held.add(action);
    }
    if (i === payload.length) {
      held.clear();
      flush();
      break;
    }
    if (!head[6]) wait = Math.max(3, head[7] * 256 + head[8]);
    // Custom-mode zero gaps continue the inner loop before USB flush.
    if (wait > 0) {
      flush();
      at += wait;
    }
  }
  return frames;
}
