import React from 'react';
import CloseIcon from './icons/CloseIcon';

interface Certificate {
    name: string;
    credits: number;
}

interface UserWithCertificates {
    name: string;
    certificates: Certificate[];
}

interface CertificateDetailModalProps {
  user: UserWithCertificates;
  onClose: () => void;
}

const CertificateDetailModal: React.FC<CertificateDetailModalProps> = ({ user, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 sm:p-8 relative max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-xl font-bold text-teal-800">Chi tiết chứng chỉ của {user.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <CloseIcon className="h-6 w-6" />
            </button>
        </header>

        <main className="flex-grow overflow-y-auto">
            {user.certificates.length > 0 ? (
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-16">STT</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Tên chứng chỉ</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-32">Số tiết</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {user.certificates.map((cert, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-center">{index + 1}</td>
                                <td className="px-4 py-3">{cert.name}</td>
                                <td className="px-4 py-3 text-center">{cert.credits}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="text-center text-gray-500 py-8">Nhân viên này không có chứng chỉ nào trong khoảng thời gian đã chọn.</p>
            )}
        </main>

        <footer className="pt-6 flex justify-end">
            <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
                Đóng
            </button>
        </footer>
      </div>
    </div>
  );
};

export default CertificateDetailModal;
