import React from 'react';

interface IconProps {
    className?: string;
}

const PrintIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6 18.75m0 0l-.224.447m.224-.447c.524.106 1.055.165 1.591.165V18.75m-1.591 0c-1.612 0-3.213-.243-4.781-.697M15 13.5c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0010.56 0m-10.56 0L18 18.75m0 0l.224.447m-.224-.447c-.524.106-1.055.165-1.591.165V18.75m1.591 0c1.612 0 3.213-.243 4.781-.697m-4.781 4.875c-1.453.23-2.944.338-4.464.338s-3.011-.108-4.464-.338m13.5 0a9.02 9.02 0 01-9 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V1.5a1.5 1.5 0 00-3 0V3.75m0 0H9.75m4.5 0c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H9.75c-.621 0-1.125-.504-1.125-1.125V4.875c0-.621.504-1.125 1.125-1.125h4.5zM3 8.25v10.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V8.25M3 16.5h18" />
    </svg>
);

export default PrintIcon;