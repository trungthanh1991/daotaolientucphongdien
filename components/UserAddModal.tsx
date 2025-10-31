

import React, { useState } from 'react';
import { UserData, Department, Title } from '../App';
import CloseIcon from './icons/CloseIcon';

interface UserAddModalProps {
  departments: Department[];
  titles: Title[];
  onAdd: (newUserData: Omit<UserData, 'id'>) => void;
  onClose: () => void;
}

const UserAddModal: React.FC<UserAddModalProps> = ({ departments, titles, onAdd, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'user',
    status: true,
    departmentId: '',
    titleId: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password) {
        setError('Vui lòng điền đầy đủ các trường bắt buộc.');
        return;
    }
    setError('');
    // FIX: The `role` from the form state is inferred as a generic `string`, which is not compatible
    // with `UserData['role']`. This creates a new object and explicitly casts `role` to the
    // correct union type, resolving a downstream type error in the parent component.
    onAdd({
      ...formData,
      status: formData.status ? 'active' : 'disabled',
      role: formData.role as UserData['role'],
      failedLoginAttempts: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <CloseIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold text-teal-800 mb-6">Thêm người dùng mới</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="name" className="block text-base font-medium text-gray-700">Họ tên *</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full input-style" />
                </div>
                <div>
                    <label htmlFor="username" className="block text-base font-medium text-gray-700">Tên đăng nhập *</label>
                    <input type="text" name="username" id="username" value={formData.username} onChange={handleChange} required className="mt-1 w-full input-style" />
                </div>
                 <div>
                    <label htmlFor="password" className="block text-base font-medium text-gray-700">Mật khẩu *</label>
                    <input type="password" name="password" id="password" value={formData.password} onChange={handleChange} required className="mt-1 w-full input-style" />
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
                 <div className="flex items-center gap-4">
                    <label htmlFor="status" className="block text-base font-medium text-gray-700">Trạng thái</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="status" id="status" checked={formData.status} onChange={handleChange} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-teal-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        <span className="ml-3 text-base font-medium text-gray-900">{formData.status ? 'Hoạt động' : 'Vô hiệu hóa'}</span>
                    </label>
                </div>
            </div>
            {error && <p className="text-base text-red-600">{error}</p>}
            <div className="pt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                <button type="submit" className="btn-primary">Thêm người dùng</button>
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

export default UserAddModal;
