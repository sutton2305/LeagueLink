import React from 'react';

const MagicWandIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 4V2" />
    <path d="M15 10V8" />
    <path d="M12.5 7.5 14 6" />
    <path d="M16 9l1.5-1.5" />
    <path d="M7 15H5" />
    <path d="M21 15h-2" />
    <path d="M19.5 12.5 21 11" />
    <path d="M18 14l1.5 1.5" />
    <path d="m3 21 9-9" />
    <path d="M12.5 19.5 14 18" />
  </svg>
);

export default MagicWandIcon;