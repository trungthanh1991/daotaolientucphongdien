import React, { useState, useEffect, useCallback } from 'react';
import { Certificate } from '../App';
import CloseIcon from './icons/CloseIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import RotateLeftIcon from './icons/RotateLeftIcon';
import RotateRightIcon from './icons/RotateRightIcon';
import DownloadIcon from './icons/DownloadIcon';
import { transformGoogleDriveUrl } from '../utils/driveUploader';

interface ImagePreviewModalProps {
  images: Certificate[];
  initialIndex: number;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [rotation, setRotation] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentImage = images[currentIndex];
  const transformedImageUrl = transformGoogleDriveUrl(currentImage?.imageUrl);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setRotation(0);
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setRotation(0);
  }, [images.length]);

  const handleRotateLeft = () => setRotation((prev) => prev - 90);
  const handleRotateRight = () => setRotation((prev) => prev + 90);

  const handleDownload = () => {
    if (!transformedImageUrl) return;
    setIsDownloading(true);

    const imageUrl = transformedImageUrl;
    const img = new Image();
    img.crossOrigin = "Anonymous"; // This requires the server (Google) to have CORS configured.

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsDownloading(false);
        return;
      }

      const angle = rotation * Math.PI / 180;
      const sin = Math.abs(Math.sin(angle));
      const cos = Math.abs(Math.cos(angle));
      const newWidth = img.width * cos + img.height * sin;
      const newHeight = img.width * sin + img.height * cos;

      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx.translate(newWidth / 2, newHeight / 2);
      ctx.rotate(angle);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const link = document.createElement('a');
      link.download = `${currentImage.name}_rotated.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setIsDownloading(false);
    };
    
    img.onerror = () => {
        alert("Không thể tải hình ảnh để xử lý. Điều này có thể do giới hạn bảo mật của trình duyệt (CORS). Vui lòng đảm bảo Google Drive đã được cấu hình CORS cho phép truy cập trực tiếp.");
        setIsDownloading(false);
    }
    
    img.src = imageUrl;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  if (!currentImage) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
        <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-full max-h-full flex items-center justify-center">
                 <img
                    key={currentIndex}
                    src={transformedImageUrl}
                    alt={currentImage.name}
                    className="max-w-[80vw] max-h-[75vh] object-contain shadow-lg transition-transform duration-300"
                    style={{ transform: `rotate(${rotation}deg)` }}
                />
            </div>

            <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors" aria-label="Đóng">
                <CloseIcon className="h-6 w-6" />
            </button>

            {images.length > 1 && (
                <>
                    <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors" aria-label="Ảnh trước">
                        <ChevronLeftIcon className="h-8 w-8" />
                    </button>
                    <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors" aria-label="Ảnh kế tiếp">
                        <ChevronRightIcon className="h-8 w-8" />
                    </button>
                </>
            )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-center items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-white text-sm hidden md:block truncate max-w-xs">{currentImage.name}</p>
            <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg">
                <button onClick={handleRotateLeft} className="text-white p-2 hover:bg-gray-700 rounded-md transition-colors" aria-label="Xoay trái">
                    <RotateLeftIcon className="h-6 w-6" />
                </button>
                <button onClick={handleRotateRight} className="text-white p-2 hover:bg-gray-700 rounded-md transition-colors" aria-label="Xoay phải">
                    <RotateRightIcon className="h-6 w-6" />
                </button>
                <button onClick={handleDownload} disabled={isDownloading} className="text-white p-2 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Tải xuống">
                    <DownloadIcon className="h-6 w-6" />
                </button>
            </div>
             <p className="text-white text-sm hidden md:block">
                {currentIndex + 1} / {images.length}
            </p>
        </div>
         <style>{`
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .animate-fade-in {
                animation: fade-in 0.2s ease-out forwards;
            }
        `}</style>
    </div>
  );
};

export default ImagePreviewModal;