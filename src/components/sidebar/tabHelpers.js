// Tabs auto-group by domain. Stacks are collapsible. Age indicator shows freshness.
const STACK_COLORS = ['#ff6234', '#2dd4a8', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

function getDomain(url) {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    return h;
  } catch {
    return null;
  }
}

function getAgeFade(lastActive) {
  if (!lastActive) return 0.15;
  const age = Date.now() - lastActive;
  const mins = age / 60000;
  if (mins < 1) return 1;
  if (mins < 5) return 0.8;
  if (mins < 30) return 0.5;
  if (mins < 120) return 0.3;
  return 0.15;
}

export { STACK_COLORS, getDomain, getAgeFade };
