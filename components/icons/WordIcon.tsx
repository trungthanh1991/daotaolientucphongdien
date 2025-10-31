import React from 'react';

interface IconProps {
    className?: string;
}

const WordIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13.5,13.5L12,18L10.5,13.5L9,18H7L9,11H11L12,14L13,11H15L17,18H15L13.5,13.5Z" fill="#2A5699" />
    </svg>
);

export default WordIcon;