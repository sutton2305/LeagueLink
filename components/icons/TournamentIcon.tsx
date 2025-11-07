import React from 'react';

const TournamentIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M6 3v4" />
    <path d="M18 3v4" />
    <path d="M6 7h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6" />
    <path d="M18 7h-5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h5" />
    <path d="M11 12h2" />
    <path d="M12 12v7" />
    <path d="M9 19h6" />
  </svg>
);

export default TournamentIcon;
