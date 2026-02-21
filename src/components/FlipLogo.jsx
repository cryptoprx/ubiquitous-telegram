import React from 'react';
import flipLogoUrl from '../assets/fliplogo.png';

export default function FlipLogo({ size = 20, className = '' }) {
  return (
    <img
      src={flipLogoUrl}
      alt="Flip"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
