import React from 'react';

export const BlueScissorIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-30 32 32)">
      {/* Blades */}
      <path d="M26 28 L56 16 L28 32 Z" fill="#94a3b8" />
      <path d="M26 36 L56 48 L28 32 Z" fill="#cbd5e1" />
      {/* Pivot screw */}
      <circle cx="28" cy="32" r="3" fill="#475569" />
      <circle cx="28" cy="32" r="1.5" fill="#f8fafc" />
      {/* Handles */}
      <circle cx="16" cy="22" r="10" stroke="#1cb0f6" strokeWidth="4.5" fill="none" />
      <circle cx="16" cy="42" r="10" stroke="#1cb0f6" strokeWidth="4.5" fill="none" />
    </g>
  </svg>
);

export const TapeRollIcon: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="24" rx="20" ry="18" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5" />
    <ellipse cx="24" cy="24" rx="11" ry="10" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1" />
    <ellipse cx="24" cy="24" rx="6" ry="5.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
  </svg>
);

export const PolaroidPhoto: React.FC<{ className?: string }> = ({ className = 'w-16 h-20' }) => (
  <svg className={className} viewBox="0 0 60 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="75" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    {/* Photo window */}
    <rect x="6" y="6" width="48" height="46" rx="2" fill="#e0f2fe" />
    <circle cx="30" cy="29" r="9" fill="#1cb0f6" />
    <rect x="6" y="44" width="48" height="8" fill="#bae6fd" opacity="0.6" />
  </svg>
);

export const PromiseUnderline: React.FC = () => (
  <svg width="90" height="8" viewBox="0 0 90 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 5 C 24 1, 62 7, 88 3"
      stroke="#1cb0f6"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);
