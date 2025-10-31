import React from 'react';
import UserIcon from './icons/UserIcon';
import CertificateIcon from './icons/CertificateIcon';
import ReportIcon from './icons/ReportIcon';
import AIAssistantIcon from './icons/AIAssistantIcon';
import AdminIcon from './icons/AdminIcon';
import { UserData } from '../App';

interface NavItemColorProps {
    active: string;
    hover: string;
    border: string;
    text: string;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  colors: NavItemColorProps;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, colors }) => {
  const baseClasses = `
    flex items-center space-x-2 p-3 flex-shrink-0
    md:w-full md:text-left md:px-4 md:py-3 md:space-x-3
    transition-all duration-300 ease-in-out transform
    focus:outline-none focus:ring-2 focus:ring-offset-2 md:rounded-lg
  `;
  
  const activeClasses = `
    ${colors.text} ${colors.border} border-b-2 font-semibold
    md:${colors.active} md:shadow-inner md:border-none
  `;
  
  const inactiveClasses = `
    text-gray-500 hover:text-gray-700 
    ${colors.hover} md:hover:translate-x-1
  `;

  return (
    <li>
      <button 
        onClick={onClick}
        className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
        aria-current={active ? 'page' : undefined}
        style={{ '--tw-ring-color': 'rgba(13, 148, 136, 0.5)' } as React.CSSProperties} // Use teal for focus ring consistently
      >
        {icon}
        <span className="font-medium text-base">{label}</span>
      </button>
    </li>
  );
};

interface MenubarProps {
    user: UserData;
    activeItem: string;
    onSelectItem: (item: string) => void;
}

const menuItemColors: { [key: string]: NavItemColorProps } = {
    'Trang cá nhân': {
        active: 'bg-gradient-to-r from-sky-50 to-sky-100',
        hover: 'md:hover:bg-sky-100',
        border: 'border-sky-500',
        text: 'text-sky-800'
    },
    'Chứng Chỉ': {
        active: 'bg-gradient-to-r from-teal-50 to-teal-100',
        hover: 'md:hover:bg-teal-100',
        border: 'border-teal-500',
        text: 'text-teal-800'
    },
    'Báo Cáo': {
        active: 'bg-gradient-to-r from-indigo-50 to-indigo-100',
        hover: 'md:hover:bg-indigo-100',
        border: 'border-indigo-500',
        text: 'text-indigo-800'
    },
    'Trợ lý AI': {
        active: 'bg-gradient-to-r from-amber-50 to-amber-100',
        hover: 'md:hover:bg-amber-100',
        border: 'border-amber-500',
        text: 'text-amber-800'
    },
    'Quản trị': {
        active: 'bg-gradient-to-r from-rose-50 to-rose-100',
        hover: 'md:hover:bg-rose-100',
        border: 'border-rose-500',
        text: 'text-rose-800'
    },
};

const Menubar: React.FC<MenubarProps> = ({ user, activeItem, onSelectItem }) => {

    const allMenuItems = [
        { id: 'Trang cá nhân', icon: <UserIcon className="h-5 w-5" />, label: 'Trang cá nhân', roles: ['admin', 'user', 'reporter_user'] },
        { id: 'Chứng Chỉ', icon: <CertificateIcon className="h-5 w-5" />, label: 'Chứng Chỉ', roles: ['admin', 'user', 'reporter_user'] },
        { id: 'Báo Cáo', icon: <ReportIcon className="h-5 w-5" />, label: 'Báo Cáo', roles: ['admin', 'reporter', 'reporter_user'] },
        { id: 'Trợ lý AI', icon: <AIAssistantIcon className="h-5 w-5" />, label: 'Trợ lý AI', roles: ['admin', 'reporter', 'reporter_user'] },
        { id: 'Quản trị', icon: <AdminIcon className="h-5 w-5" />, label: 'Quản trị', roles: ['admin'] },
    ];

    const visibleMenuItems = allMenuItems.filter(item => 
        user.role && item.roles.includes(user.role)
    );
    
  return (
    <aside className="bg-slate-100 md:border-r md:border-slate-200 md:p-4 md:flex md:flex-col md:h-full">
        <div className="md:py-4 md:mb-4 hidden md:block">
             {/* You can add a logo here if needed */}
        </div>
      <nav className="shadow-sm md:shadow-none bg-slate-100">
        <ul className="flex flex-row overflow-x-auto md:flex-col divide-x divide-slate-200 md:divide-x-0 md:divide-y md:divide-slate-200">
            {visibleMenuItems.map(item => (
                <NavItem 
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={activeItem === item.id}
                    onClick={() => onSelectItem(item.id)}
                    colors={menuItemColors[item.id]}
                />
            ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Menubar;