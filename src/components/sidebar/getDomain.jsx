import { getDomain } from './tabHelpers';

function getDomain(url) {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    return h;
  } catch {
    return null;
  }
}

export default getDomain;
