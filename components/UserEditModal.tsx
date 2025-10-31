

import React, { useState, useEffect } from 'react';
import { UserData, Department, Title } from '../App';
import CloseIcon from './icons/CloseIcon';

interface UserEditModalProps {
  user: UserData;
  departments: Department[];
  titles: Title[];
  onSave: (updatedData: Partial<UserData>) => void;
  onClose: () => void;
}

// Helper to format a Date object to a 'YYYY-MM-DD' string based on UTC
const formatDateToYyyyMmDd = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const UserEditModal: React.FC<UserEditModalProps> = ({ user, departments, titles, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    role: 'user' as UserData['role'],
    status: 'active' as UserData['status'],
    departmentId: '',
    titleId: '',
    position: '',
    practiceCertificateNumber: '',
    practiceCertificateIssueDate: '',
    dateOfBirth: '',
  });

  useEffect(() => {
    setFormData({
      name: user.name || '',
      role: user.role || 'user',
      status: user.status || 'active',
      departmentId: user.departmentId || '',
      titleId: user.titleId || '',
      position: user.position || '',
      practiceCertificateNumber: user.practiceCertificateNumber || '',
      practiceCertificateIssueDate: user.practiceCertificateIssueDate
        ? formatDateToYyyyMmDd(user.practiceCertificateIssueDate.toDate())
        : '',
      dateOfBirth: user.dateOfBirth ? formatDateToYyyyMmDd(user.dateOfBirth.toDate()) : '',
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    if (user.status === 'locked') {
        // From locked, you can only disable. Re-checking keeps it locked.
        setFormData(prev => ({ ...prev, status: checked ? 'locked' : 'disabled' }));
    } else {
        setFormData(prev => ({ ...prev, status: checked ? 'active' : 'disabled' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const dataToSave: Partial<UserData> = {
        name: formData.name,
        role: formData.role,
        status: formData.status,
        departmentId: formData.departmentId,
        titleId: formData.titleId,
        position: formData.position,
        practiceCertificateNumber: formData.practiceCertificateNumber,
    };
    
    // If status was locked and remains locked, we don't need to send the update for status.
    if (user.status === 'locked' && formData.status === 'locked') {
        delete dataToSave.status;
    }

    // Parsing a 'YYYY-MM-DD' string with new Date() creates a UTC date.
    // This prevents the date from shifting due to the user's local timezone.
    if (formData.practiceCertificateIssueDate) {
        (dataToSave as any).practiceCertificateIssueDate = new Date(formData.practiceCertificateIssueDate);
    }

    if (formData.dateOfBirth) {
        (dataToSave as any).dateOfBirth = new Date(formData.dateOfBirth);
    }

    onSave(dataToSave);
  };
  
  const getStatusText = () => {
    if (formData.status === 'locked') return 'Bị khóa';
    if (formData.status === 'active') return 'Hoạt động';
    return 'Vô hiệu hóa';
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <CloseIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold text-teal-800 mb-6">Chỉnh sửa người dùng</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-base font-medium text-gray-700">Tên đăng nhập</label>
                    <input type="text" value={user.username} disabled className="mt-1 w-full input-style bg-gray-100 cursor-not-allowed" />
                </div>
                <div>
                    <label htmlFor="name" className="block text-base font-medium text-gray-700">Họ tên *</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full input-style" />
                </div>
                 <div>
                    <label htmlFor="dateOfBirth" className="block text-base font-medium text-gray-700">Ngày sinh</label>
                    <input type="date" name="dateOfBirth" id="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="mt-1 w-full input-style" />
                </div>
                <div>
                    <label htmlFor="role" className="block text-base font-medium text-gray-700">Vai trò</label>
                    <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 w-full input-style">
                        <option value="user">Nhân viên</option>
                        <option value="reporter">Báo cáo viên</option>
                        <option value="reporter_user">Nhân viên & Báo cáo</option>
                        <option value="admin">Quản trị viên</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="departmentId" className="block text-base font-medium text-gray-700">Khoa/Phòng</label>
                    <select name="departmentId" id="departmentId" value={formData.departmentId} onChange={handleChange} className="mt-1 w-full input-style">
                        <option value="">Không có</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="titleId" className="block text-base font-medium text-gray-700">Chức danh</label>
                    <select name="titleId" id="titleId" value={formData.titleId} onChange={handleChange} className="mt-1 w-full input-style">
                        <option value="">Không có</option>
                        {titles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="position" className="block text-base font-medium text-gray-700">Chức vụ</label>
                    <input type="text" name="position" id="position" value={formData.position} onChange={handleChange} className="mt-1 w-full input-style" />
                </div>
                <div>
                    <label htmlFor="practiceCertificateNumber" className="block text-base font-medium text-gray-700">Số CCHN</label>
                    <input type="text" name="practiceCertificateNumber" id="practiceCertificateNumber" value={formData.practiceCertificateNumber} onChange={handleChange} className="mt-1 w-full input-style" />
                </div>
                <div>
                    <label htmlFor="practiceCertificateIssueDate" className="block text-base font-medium text-gray-700">Ngày cấp CCHN</label>
                    <input type="date" name="practiceCertificateIssueDate" id="practiceCertificateIssueDate" value={formData.practiceCertificateIssueDate} onChange={handleChange} className="mt-1 w-full input-style" />
                </div>
                 <div className="flex items-center gap-4 md:col-span-3">
                    <label htmlFor="status" className="block text-base font-medium text-gray-700">Trạng thái</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="status" id="status" checked={formData.status !== 'disabled'} onChange={handleStatusChange} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-teal-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        <span className="ml-3 text-base font-medium text-gray-900">{getStatusText()}</span>
                    </label>
                </div>
            </div>
            <div className="pt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                <button type="submit" className="btn-primary">Lưu thay đổi</button>
            </div>
        </form>
        <style>{`
            .input-style {
                box-sizing: border-box;
                width: 100%;
                margin-top: 0.25rem;
                padding: 0.5rem 0.75rem;
                border: 1px solid #D1D5DB;
                border-radius: 0.375rem;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                background-color: #FFFFFF;
            }
            .input-style:focus {
                outline: 2px solid transparent;
                outline-offset: 2px;
                --tw-ring-color: #14B8A6;
                box-shadow: 0 0 0 2px var(--tw-ring-color);
                border-color: #14B8A6;
            }
            .btn-primary {
                background-color: #0D9488;
                color: white;
                font-weight: 600;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                transition: background-color 0.2s;
            }
            .btn-primary:hover {
                background-color: #0F766E;
            }
            .btn-secondary {
                background-color: #E5E7EB;
                color: #374151;
                font-weight: 600;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                transition: background-color 0.2s;
            }
            .btn-secondary:hover {
                background-color: #D1D5DB;
            }
        `}</style>
      </div>
    </div>
  );
};

export default UserEditModal;
