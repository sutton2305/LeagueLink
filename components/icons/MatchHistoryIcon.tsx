
import React from 'react';

export const MatchHistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M12 22V10"/>
        <path d="M12 10l5 5"/>
        <path d="M12 10l-5 5"/>
        <path d="M17 3l-5 5"/>
        <path d="M7 3l5 5"/>
    </svg>
);
