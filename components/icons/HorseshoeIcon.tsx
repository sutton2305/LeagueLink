
import React from 'react';

const HorseshoeIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M12 22a7 7 0 0 0-7-7V6a7 7 0 0 1 14 0v9a7 7 0 0 0-7 7Z" />
    <path d="M16 6H8" />
  </svg>
);

export default HorseshoeIcon;
