import { getAgeFade } from './tabHelpers';

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

export default getAgeFade;
