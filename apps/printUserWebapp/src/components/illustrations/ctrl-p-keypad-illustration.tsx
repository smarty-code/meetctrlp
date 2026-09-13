import React from 'react';

export const CtrlPKeypadIllustration: React.FC = () => {
  return (
    <div className="relative w-[180px] h-[130px] mx-auto select-none pointer-events-none">
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cable */}
        <path
          d="M90 26 L90 2 C90 -8 78 -12 70 -16"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="85" y="22" width="10" height="6" rx="2" fill="#000437" />

        {/* Keypad Base */}
        <g transform="rotate(-6 90 65)">
          {/* Main Chassis (flat midnight background with graphite border) */}
          <rect
            x="36"
            y="26"
            width="108"
            height="86"
            rx="12"
            fill="#000437"
            stroke="#3c3c3c"
            strokeWidth="2"
          />

          {/* Recessed key area */}
          <rect x="42" y="32" width="96" height="50" rx="8" fill="#042c60" />

          {/* Keycap 1: "Ctrl" */}
          <g transform="translate(46, 36)">
            {/* 3D Keycap sides */}
            <path d="M4 10 L8 4 L38 4 L42 10 L42 38 L38 42 L8 42 L4 38 Z" fill="#cbd5e1" stroke="#3c3c3c" strokeWidth="1" />
            <rect
              x="6"
              y="6"
              width="34"
              height="28"
              rx="4"
              fill="#ffffff"
              stroke="#3c3c3c"
              strokeWidth="1.2"
            />
            <text
              x="23"
              y="24"
              textAnchor="middle"
              fill="#000437"
              fontSize="11"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
            >
              Ctrl
            </text>
          </g>

          {/* Keycap 2: "P" */}
          <g transform="translate(90, 36)">
            <path d="M4 10 L8 4 L38 4 L42 10 L42 38 L38 42 L8 42 L4 38 Z" fill="#cbd5e1" stroke="#3c3c3c" strokeWidth="1" />
            <rect
              x="6"
              y="6"
              width="34"
              height="28"
              rx="4"
              fill="#ffffff"
              stroke="#3c3c3c"
              strokeWidth="1.2"
            />
            <text
              x="23"
              y="25"
              textAnchor="middle"
              fill="#000437"
              fontSize="14"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
            >
              P
            </text>
          </g>

          {/* Brand Badge */}
          <g transform="translate(68, 88)">
            <rect x="0" y="0" width="44" height="14" rx="7" fill="#58cc02" />
            <text
              x="22"
              y="10.5"
              textAnchor="middle"
              fill="#000437"
              fontSize="8.5"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.2"
            >
              CtrlP
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
