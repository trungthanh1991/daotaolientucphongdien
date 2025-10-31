
import React, { useState, useEffect } from 'react';
import { UserData, Department, Title } from '../App';
import CloseIcon from './icons/CloseIcon';

interface ProfileEditModalProps {
  user: UserData;
  departments: Department[];
  titles: Title[];
  onSave: (updatedData: Partial<UserData>) => void;
  onClose: () => void;
}

interface ProfileFormData {
  departmentId: string;
  position: string;
  titleId: string;
  practiceCertificateNumber: string;
  practiceCertificateIssueDate: string;
  dateOfBirth: string;
}

// Helper to format a Date object to a 'YYYY-MM-DD' string based on UTC
const formatDateToYyyyMmDd = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ user, departments, titles, onSave, onClose }) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    departmentId: '',
    position: '',
    titleId: '',
    practiceCertificateNumber: '',
    practiceCertificateIssueDate: '',
    dateOfBirth: '',
  });

  useEffect(() => {
    setFormData({
      departmentId: user.departmentId || '',
      position: user.position || '',
      titleId: user.titleId || '',
      practiceCertificateNumber: user.practiceCertificateNumber || '',
      practiceCertificateIssueDate: user.practiceCertificateIssueDate
        ? formatDateToYyyyMmDd(user.practiceCertificateIssueDate.toDate())
        : '',
      dateOfBirth: user.dateOfBirth && user.dateOfBirth.toDate
        ? formatDateToYyyyMmDd(user.dateOfBirth.toDate())
        : '',
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const dataToSave: Partial<UserData> = {
        departmentId: formData.departmentId,
        position: formData.position,
        titleId: formData.titleId,
        practiceCertificateNumber: formData.practiceCertificateNumber,
    };
    
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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8 m-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Đóng"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold text-teal-800 mb-6">Chỉnh sửa thông tin cá nhân</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-base font-medium text-gray-700">Họ và tên</label>
                    <input
                        type="text"
                        value={user.name}
                        disabled
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label htmlFor="departmentId" className="block text-base font-medium text-gray-700">Khoa/Phòng</label>
                    <select
                        id="departmentId"
                        name="departmentId"
                        value={formData.departmentId}
                        onChange={handleChange}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white"
                    >
                        <option value="">Chọn khoa/phòng</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>
                                {dept.name}
                            </option>
                        ))}
                    </select>
                </div>
                 <div>
                    <label htmlFor="dateOfBirth" className="block text-base font-medium text-gray-700">Ngày sinh</label>
                    <input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
                <div>
                    <label htmlFor="titleId" className="block text-base font-medium text-gray-700">Chức danh</label>
                    <select
                        id="titleId"
                        name="titleId"
                        value={formData.titleId}
                        onChange={handleChange}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white"
                    >
                        <option value="">Chọn chức danh</option>
                        {titles.map(title => (
                            <option key={title.id} value={title.id}>
                                {title.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="position" className="block text-base font-medium text-gray-700">Chức vụ</label>
                    <input
                        id="position"
                        name="position"
                        type="text"
                        value={formData.position}
                        onChange={handleChange}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
                 <div>
                    <label htmlFor="practiceCertificateNumber" className="block text-base font-medium text-gray-700">Số CCHN</label>
                    <input
                        id="practiceCertificateNumber"
                        name="practiceCertificateNumber"
                        type="text"
                        value={formData.practiceCertificateNumber}
                        onChange={handleChange}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
                 <div>
                    <label htmlFor="practiceCertificateIssueDate" className="block text-base font-medium text-gray-700">Ngày cấp CCHN</label>
                    <input
                        id="practiceCertificateIssueDate"
                        name="practiceCertificateIssueDate"
                        type="date"
                        value={formData.practiceCertificateIssueDate}
                        onChange={handleChange}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
            </div>
            <div className="pt-6 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors"
                >
                    Lưu thay đổi
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEditModal;