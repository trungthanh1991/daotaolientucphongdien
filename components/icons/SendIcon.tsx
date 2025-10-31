
import React from 'react';

interface IconProps {
  className?: string;
}

const SendIcon: React.FC<IconProps> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        aria-hidden="true"
    >
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

export default SendIcon;
