// FIX: Import 'useMemo' to resolve reference error.
import React, { useState, useEffect, useMemo } from 'react';
import CloseIcon from './icons/CloseIcon';

interface SharedReport {
  id: string;
  reportTitle: string;
  expiresAt: { toDate: () => Date };
  [key: string]: any;
}

interface UpdateExpirationModalProps {
  report: SharedReport;
  onSave: (report: SharedReport, newDate: Date) => void;
  onClose: () => void;
}

const formatDateToYyyyMmDd = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const UpdateExpirationModal: React.FC<UpdateExpirationModalProps> = ({ report, onSave, onClose }) => {
    const [newDateString, setNewDateString] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (report) {
            setNewDateString(formatDateToYyyyMmDd(report.expiresAt.toDate()));
        }
    }, [report]);

    const todayString = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return formatDateToYyyyMmDd(today);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const newDate = new Date(newDateString);
        
        // Adjust for timezone offset to compare dates correctly
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (isNaN(newDate.getTime())) {
            setError('Ngày không hợp lệ.');
            return;
        }
        
        if (newDate < today) {
            setError('Ngày hết hạn không được là một ngày trong quá khứ.');
            return;
        }

        onSave(report, newDate);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 sm:p-8 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                    <CloseIcon className="h-6 w-6" />
                </button>
                <h2 className="text-2xl font-bold text-teal-800 mb-4">Thay đổi Ngày hết hạn</h2>
                <p className="text-gray-600 mb-2">Báo cáo: <span className="font-semibold">{report.reportTitle}</span></p>
                <p className="text-gray-600 mb-6">Hạn hiện tại: {report.expiresAt.toDate().toLocaleDateString('vi-VN')}</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="new-expiration-date" className="block text-base font-medium text-gray-700">Chọn ngày hết hạn mới</label>
                        <input
                            id="new-expiration-date"
                            type="date"
                            value={newDateString}
                            onChange={(e) => setNewDateString(e.target.value)}
                            min={todayString}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                            Hủy
                        </button>
                        <button type="submit" className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
                            Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpdateExpirationModal;