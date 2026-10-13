// Small helper shared by the realtime mini-games (Harf, Wobble Race, …). supabase-js has
// no way to remove a `.on()` broadcast binding, so each event is bound to the channel
// exactly once and fanned out to a Set of listeners that can be added/removed freely —
// otherwise a remount (React StrictMode, a hook re-running) would stack duplicate
// handlers and every message would fire twice, three times, etc.
const registry = new WeakMap<object, Map<string, Set<(payload: any) => void>>>();

export function listen(channel: any, event: string, fn: (payload: any) => void): () => void {
  let events = registry.get(channel);
  if (!events) {
    events = new Map();
    registry.set(channel, events);
  }
  let set = events.get(event);
  if (!set) {
    const created = new Set<(payload: any) => void>();
    set = created;
    events.set(event, created);
    channel.on('broadcast', { event }, (msg: any) => created.forEach((f) => f(msg.payload)));
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}
