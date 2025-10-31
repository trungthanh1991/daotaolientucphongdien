import React from 'react';

interface IconProps {
  className?: string;
}

const LogoIcon: React.FC<IconProps> = ({ className }) => (
    <svg 
        className={className} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#0B579E" strokeWidth="4"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#0B579E" strokeWidth="1"/>
        
        {/* Medical Cross */}
        <path d="M50 30 V 70 M 35 45 H 65" stroke="#0B579E" strokeWidth="10" strokeLinecap="round"/>
        
        {/* Asclepius Snake */}
        <path 
            d="M50 68 C 58 62, 58 52, 50 46 C 42 40, 42 30, 50 24" 
            stroke="#FFFFFF"
            strokeWidth="3.5" 
            fill="none"
        />
        <path 
            d="M50 68 C 58 62, 58 52, 50 46 C 42 40, 42 30, 50 24" 
            stroke="#0B579E" 
            strokeWidth="3" 
            fill="none"
        />

        {/* Decorative text path (visual only) */}
        <defs>
            <path id="upperTextPath" d="M20,65 A40,40 0 0,1 80,65" transform="translate(0, -15)" />
            <path id="lowerTextPath" d="M25,35 A40,40 0 0,0 75,35" transform="translate(0, 15)" />
        </defs>
        <text fill="#C41E3A" fontSize="6" fontWeight="bold">
            <textPath href="#upperTextPath" startOffset="50%" textAnchor="middle">
                BỆNH VIỆN Y HỌC CỔ TRUYỀN
            </textPath>
        </text>
        <text fill="#0B579E" fontSize="6" fontWeight="bold">
            <textPath href="#lowerTextPath" startOffset="50%" textAnchor="middle">
                TRUNG TÂM Y TẾ HỌC LỘC
            </textPath>
        </text>
    </svg>
);

export default LogoIcon;
