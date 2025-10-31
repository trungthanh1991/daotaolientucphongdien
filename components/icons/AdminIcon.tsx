import React from 'react';

interface IconProps {
  className?: string;
}

const AdminIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 0A11.953 11.953 0 0112 2.75c1.767 0 3.45.364 5.002 1.017M12 2.75c-1.767 0-3.45.364-5.002 1.017m10.004 0h.008v.008h-.008v-.008z" />
    </svg>
);

export default AdminIcon;
