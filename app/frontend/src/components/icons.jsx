import React from 'react';

const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconGamepad = (props) => (
  <svg {...base} {...props}>
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="8" y1="10" x2="8" y2="14" />
    <line x1="15" y1="13" x2="15.01" y2="13" />
    <line x1="18" y1="11" x2="18.01" y2="11" />
    <rect x="2" y="6" width="20" height="12" rx="4" />
  </svg>
);

export const IconBriefcase = (props) => (
  <svg {...base} {...props}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export const IconRobot = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
    <path d="M1 14h2" />
    <path d="M21 14h2" />
  </svg>
);

export const IconSparkle = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </svg>
);

export const IconFire = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c1.5 2 2 4 2 6a8 8 0 1 1-16 0c0-3 1.5-5 3-7 1-1.5 1.5-3 1-6z" />
  </svg>
);

export const IconTarget = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

export const IconTrophy = (props) => (
  <svg {...base} {...props}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 5H4a3 3 0 0 0 3 5" />
    <path d="M17 5h3a3 3 0 0 1-3 5" />
  </svg>
);

export const IconPin = (props) => (
  <svg {...base} {...props}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const IconBuilding = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <line x1="8" y1="7" x2="8" y2="7" />
    <line x1="12" y1="7" x2="12" y2="7" />
    <line x1="16" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="8" y2="11" />
    <line x1="12" y1="11" x2="12" y2="11" />
    <line x1="16" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="8" y2="15" />
    <line x1="16" y1="15" x2="16" y2="15" />
    <path d="M10 21v-4h4v4" />
  </svg>
);

export const IconWarning = (props) => (
  <svg {...base} {...props}>
    <path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.3h17.8a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.6 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12" y2="17" />
  </svg>
);

export const IconWand = (props) => (
  <svg {...base} {...props}>
    <path d="M15 4V2M15 10V8M11.5 5.5 13 7M18 5.5 16.5 7" />
    <path d="M4 20 17 7l-3-3L1 17z" />
    <path d="M14 4h.01" />
  </svg>
);

export const IconDocument = (props) => (
  <svg {...base} {...props}>
    <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
    <path d="M15 2v5h5" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

export const IconClipboard = (props) => (
  <svg {...base} {...props}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </svg>
);

export const IconLinkedIn = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="7" y1="10" x2="7" y2="16" />
    <line x1="7" y1="7" x2="7" y2="7" />
    <path d="M11 16v-6" />
    <path d="M11 12.5a2.5 2.5 0 0 1 5 0V16" />
  </svg>
);
