import React from 'react';

export const DocumentCollageIllustration: React.FC = () => {
  return (
    <div className="relative w-[116px] h-[96px] shrink-0 select-none pointer-events-none">
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 116 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Back Document: VISA Application */}
        <g transform="translate(6, 6) rotate(-8)">
          <rect width="52" height="70" rx="4" fill="#ffffff" stroke="#3c3c3c" strokeWidth="1.5" />
          <text x="8" y="14" fill="#000437" fontSize="7" fontWeight="bold" fontFamily="system-ui">
            VISA
          </text>
          <rect x="8" y="20" width="16" height="18" rx="2" fill="#d7ffb8" stroke="#58cc02" strokeWidth="1" />
          <line x1="28" y1="22" x2="46" y2="22" stroke="#1cb0f6" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="28" y1="28" x2="44" y2="28" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="28" y1="34" x2="42" y2="34" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="46" x2="44" y2="46" stroke="#3c3c3c" strokeWidth="0.8" />
          <line x1="8" y1="52" x2="40" y2="52" stroke="#3c3c3c" strokeWidth="0.8" />
          <line x1="8" y1="58" x2="32" y2="58" stroke="#3c3c3c" strokeWidth="0.8" />
        </g>

        {/* Right Document: RENT RECEIPT */}
        <g transform="translate(58, 12) rotate(6)">
          <rect width="50" height="66" rx="4" fill="#ffffff" stroke="#3c3c3c" strokeWidth="1.5" />
          <text x="7" y="13" fill="#000437" fontSize="6.5" fontWeight="bold" fontFamily="system-ui">
            RENT
          </text>
          <text x="7" y="20" fill="#000437" fontSize="6.5" fontWeight="bold" fontFamily="system-ui">
            RECEIPT
          </text>
          <line x1="7" y1="26" x2="43" y2="26" stroke="#777777" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="7" y1="34" x2="35" y2="34" stroke="#4b4b4b" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="40" x2="42" y2="40" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="46" x2="38" y2="46" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="52" x2="44" y2="52" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="24" y="55" width="20" height="7" rx="2" fill="#d7ffb8" stroke="#58cc02" strokeWidth="1" />
          <text x="27" y="60.5" fill="#000437" fontSize="5" fontWeight="bold">PAID</text>
        </g>

        {/* Front Highlight: SCHOOL PROJECT booklet */}
        <g transform="translate(24, 26) rotate(1)">
          {/* White booklet with Lingot Lime / Ecto Green border */}
          <rect width="56" height="64" rx="4" fill="#ffffff" stroke="#58cc02" strokeWidth="2" />
          {/* Header badge in Macaw Blue */}
          <rect x="12" y="5" width="32" height="7" rx="2" fill="#1cb0f6" />
          <text x="14" y="10.5" fill="#ffffff" fontSize="4.5" fontWeight="bold" letterSpacing="0.4">
            SEMESTER 1
          </text>

          {/* School project title */}
          <text x="10" y="23" fill="#000437" fontSize="6.5" fontWeight="900" fontFamily="system-ui">
            SCHOOL
          </text>
          <text x="9" y="31" fill="#1cb0f6" fontSize="7" fontWeight="900" fontFamily="system-ui">
            PROJECT
          </text>

          {/* Molecule / Science icon */}
          <g transform="translate(28, 41) scale(0.65)">
            <circle cx="0" cy="0" r="4" fill="#58cc02" />
            <circle cx="14" cy="-8" r="3.5" fill="#1cb0f6" />
            <circle cx="16" cy="8" r="3.5" fill="#a5ed6e" />
            <circle cx="-14" cy="5" r="3" fill="#000437" />
            <line x1="0" y1="0" x2="14" y2="-8" stroke="#3c3c3c" strokeWidth="1.5" />
            <line x1="0" y1="0" x2="16" y2="8" stroke="#3c3c3c" strokeWidth="1.5" />
            <line x1="0" y1="0" x2="-14" y2="5" stroke="#3c3c3c" strokeWidth="1.5" />
          </g>

          <text x="8" y="57" fill="#777777" fontSize="4" fontFamily="system-ui">
            Subject: Applied Science
          </text>
        </g>
      </svg>
    </div>
  );
};
