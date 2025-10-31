

import React, { useState } from 'react';
import LockIcon from './icons/LockIcon';
import LogoutIcon from './icons/LogoutIcon';
import { UserData } from '../App';
import ChangePasswordModal from './ChangePasswordModal';

interface HeaderProps {
  user: UserData;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg w-full sticky top-0 z-10">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-base sm:text-lg md:text-xl font-bold truncate">Hệ thống Đào tạo Liên tục</h1>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className="text-sm sm:text-base hidden sm:block font-medium">Chào, {user.name}</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 text-base px-3 py-2 rounded-lg bg-transparent hover:bg-white/20 transition-all duration-200"
              aria-label="Đổi mật khẩu"
            >
              <LockIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Đổi mật khẩu</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 text-base px-3 py-2 rounded-lg bg-transparent hover:bg-white/20 transition-all duration-200"
              aria-label="Đăng xuất"
            >
              <LogoutIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>
      {isModalOpen && (
        <ChangePasswordModal 
          user={user} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  );
};

export default Header;