import React from 'react';

interface IconProps {
  className?: string;
}

const QRIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.5 4.5h6v6h-6v-6ZM13.5 4.5h6v6h-6v-6ZM4.5 13.5h6v6h-6v-6ZM18 13.5h1.5v3h3v1.5h-3v3h-1.5v-3h-3v-1.5h3v-3ZM15 6h1.5v1.5H15V6Zm0 6h1.5v1.5H15v-1.5ZM6 6h1.5v1.5H6V6Zm6 6h1.5v1.5H12v-1.5Zm-1.5-1.5h-1.5v1.5h1.5V9Zm-3-3H6v1.5h1.5V6Z"/>
    </svg>
);

export default QRIcon;
