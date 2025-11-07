
import React from 'react';

const SwordsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m2 2 20 20" />
    <path d="M14.5 14.5 22 7" />
    <path d="m5 5 7 7" />
    <path d="M2 12h20" />
    <path d="m22 2-20 20" />
    <path d="m9.5 9.5-7-7" />
    <path d="m19 19-7-7" />
    <path d="M12 22V2" />
  </svg>
);

export default SwordsIcon;
