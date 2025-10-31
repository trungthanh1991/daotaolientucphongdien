import React from 'react';

interface IconProps {
  className?: string;
}

const AIAssistantIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.5 1.591L5.25 12.036M5.25 12.036l4.5 4.5m0 0v5.714a2.25 2.25 0 01-1.591.5M12 5.25v2.25m0 0l4.5 4.5m-4.5-4.5L7.5 3.104M12 12.75v2.25m0 0l4.5 4.5m-4.5-4.5L7.5 12.036m3.75 0a.375.375 0 01.375.375v.375a.375.375 0 01-.375.375h-.375a.375.375 0 01-.375-.375v-.375a.375.375 0 01.375-.375z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-2.25 2.25m0 0l2.25 2.25m-2.25-2.25L15 6m4.5 4.5l-2.25-2.25M19.5 12l2.25 2.25m0 0l2.25-2.25m-2.25 2.25L15 15.75" />
    </svg>
);

export default AIAssistantIcon;
