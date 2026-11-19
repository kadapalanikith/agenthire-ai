/** Fallback label when the spec is not loaded yet: "matching_agent" → "Matching agent". */
export function humanizeNode(name) {
  const s = String(name || '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function nodeLabel(spec, name) {
  return spec?.node_labels?.[name] || humanizeNode(name);
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Colours for a node state from specs/workflow/node-states.json for the active theme. */
export function nodeStateStyle(spec, status, scheme) {
  const state = spec?.node_states?.[status];
  if (!state) return { label: humanizeNode(status), fg: undefined, bg: undefined, border: undefined };
  const colors = state[scheme === 'dark' ? 'dark' : 'light'];
  return { label: state.label, ...colors };
}
