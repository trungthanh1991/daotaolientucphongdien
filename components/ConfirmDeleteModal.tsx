
import React from 'react';

interface ConfirmDeleteModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ message, onConfirm, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900">Xác nhận hành động</h3>
        <p className="mt-2 text-base text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
          >
            Xác nhận Xóa
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;