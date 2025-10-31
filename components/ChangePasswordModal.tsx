

import React, { useState } from 'react';
import { UserData } from '../App';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import CloseIcon from './icons/CloseIcon';
import EyeIcon from './icons/EyeIcon';
import EyeOffIcon from './icons/EyeOffIcon';
import { logAction } from '../utils/logger';

interface ChangePasswordModalProps {
  user: UserData;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp. Vui lòng nhập lại.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    try {
      const userDocRef = doc(db, 'Users', user.id);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setError('Không tìm thấy thông tin người dùng.');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      
      // SECURITY WARNING: This application compares passwords in plaintext.
      // This is a major security vulnerability and should be replaced with
      // a secure authentication system like Firebase Authentication in a real product.
      if (userData.password !== currentPassword) {
        setError('Mật khẩu hiện tại không chính xác.');
        setLoading(false);
        return;
      }
      
      if (userData.password === newPassword) {
        setError('Mật khẩu mới phải khác mật khẩu cũ.');
        setLoading(false);
        return;
      }

      await updateDoc(userDocRef, { password: newPassword });
      setSuccess('Đổi mật khẩu thành công!');
      
      // Log the action
      await logAction(user, 'USER_PASSWORD_CHANGE', { type: 'User', id: user.id, name: user.name });

      // Clear fields and close modal after a delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      console.error("Password Change Error:", err);
      setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const renderInputWithToggle = (
    id: string,
    label: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isVisible: boolean,
    toggleVisibility: () => void
  ) => (
    <div>
      <label htmlFor={id} className="block text-base font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          required
          value={value}
          onChange={onChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          aria-label={isVisible ? `Ẩn ${label}` : `Hiển thị ${label}`}
        >
          {isVisible ? <EyeOffIcon className="h-6 w-6" /> : <EyeIcon className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md relative animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8">
            <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Đóng"
            >
            <CloseIcon className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold text-teal-800 mb-6">Đổi mật khẩu</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                {renderInputWithToggle('currentPassword', 'Mật khẩu cũ', currentPassword, (e) => setCurrentPassword(e.target.value), showCurrentPassword, () => setShowCurrentPassword(v => !v))}
                {renderInputWithToggle('newPassword', 'Mật khẩu mới', newPassword, (e) => setNewPassword(e.target.value), showNewPassword, () => setShowNewPassword(v => !v))}
                {renderInputWithToggle('confirmPassword', 'Nhập lại mật khẩu mới', confirmPassword, (e) => setConfirmPassword(e.target.value), showNewPassword, () => setShowNewPassword(v => !v))}

                {error && <p className="text-base text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
                {success && <p className="text-base text-green-600 bg-green-50 p-3 rounded-md">{success}</p>}

                <div className="pt-6 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors w-32 disabled:bg-teal-400 disabled:cursor-not-allowed"
                        disabled={loading || !!success}
                    >
                        {loading ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </div>
            </form>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ChangePasswordModal;