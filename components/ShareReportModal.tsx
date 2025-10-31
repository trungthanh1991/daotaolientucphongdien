import React, { useState } from 'react';
import CloseIcon from './icons/CloseIcon';
import CheckIcon from './icons/CheckIcon';
import DownloadIcon from './icons/DownloadIcon';
import { UserData } from '../App';

interface ShareReportModalProps {
    shareUrl: string;
    expiresAt: Date;
    token: string;
    userRole: UserData['role'];
    onClose: () => void;
}

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);


const ShareReportModal: React.FC<ShareReportModalProps> = ({ shareUrl, expiresAt, token, userRole, onClose }) => {
    const [copyImageStatus, setCopyImageStatus] = useState<'idle' | 'success'>('idle');
    const [copyLinkStatus, setCopyLinkStatus] = useState<'idle' | 'success'>('idle');
    const [isDownloading, setIsDownloading] = useState(false);
    
    const fullShareUrl = `${shareUrl}&token=${token}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(fullShareUrl)}`;

    const handleCopyLink = () => {
        if (!navigator.clipboard) {
            alert('Trình duyệt của bạn không hỗ trợ sao chép vào clipboard.');
            return;
        }
        navigator.clipboard.writeText(fullShareUrl).then(() => {
            setCopyLinkStatus('success');
            setTimeout(() => setCopyLinkStatus('idle'), 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Không thể sao chép liên kết.');
        });
    };

    const handleCopyImage = async () => {
        if (!navigator.clipboard?.write) {
            alert('Trình duyệt của bạn không hỗ trợ sao chép hình ảnh.');
            return;
        }

        try {
            const response = await fetch(qrCodeUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            setCopyImageStatus('success');
            setTimeout(() => setCopyImageStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to copy image:', error);
            alert('Không thể sao chép hình ảnh. Vui lòng thử tải xuống.');
        }
    };

    const handleDownloadImage = async () => {
        setIsDownloading(true);
        try {
            const response = await fetch(qrCodeUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'QR-Bao-cao.png';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Failed to download image:', error);
            alert('Không thể tải xuống hình ảnh.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 sm:p-8 relative text-center" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                    <CloseIcon className="h-6 w-6" />
                </button>
                <h2 className="text-2xl font-bold text-teal-800 mb-2">Chia sẻ Báo cáo</h2>
                <p className="text-gray-600 mb-4">Quét mã QR hoặc sử dụng liên kết bên dưới. Mã sẽ hết hạn vào lúc {expiresAt.toLocaleString('vi-VN')}.</p>
                
                <div className="flex justify-center my-6">
                    <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 rounded-lg border-4 border-gray-200 shadow-sm" />
                </div>

                <div className="space-y-4">
                     {userRole === 'admin' && (
                        <div>
                            <label htmlFor="share-link-input" className="text-sm font-medium text-gray-700 text-left block mb-1">Liên kết chia sẻ</label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="share-link-input"
                                    type="text"
                                    value={fullShareUrl}
                                    readOnly
                                    className="flex-grow bg-gray-100 p-2 border border-gray-300 rounded-md text-sm w-full"
                                    onFocus={(e) => e.target.select()}
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className={`flex-shrink-0 p-2 rounded-md transition-colors border ${copyLinkStatus === 'success' ? 'bg-green-100 border-green-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                                    aria-label="Sao chép liên kết"
                                    disabled={copyLinkStatus === 'success'}
                                >
                                    {copyLinkStatus === 'success' ? <CheckIcon className="h-5 w-5 text-green-600" /> : <CopyIcon className="h-5 w-5 text-gray-600" />}
                                </button>
                            </div>
                        </div>
                     )}

                    <div className="flex items-center justify-center gap-4">
                        <button 
                            onClick={handleCopyImage} 
                            className={`flex items-center justify-center gap-2 w-full py-2 px-4 rounded-md shadow-sm text-base font-medium transition-colors border ${
                                copyImageStatus === 'success' 
                                    ? 'bg-green-500 text-white border-green-500' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                            disabled={copyImageStatus === 'success'}
                        >
                            {copyImageStatus === 'success' ? (
                                <>
                                    <CheckIcon className="h-5 w-5" />
                                    <span>Đã chép ảnh</span>
                                </>
                            ) : (
                                <>
                                    <CopyIcon className="h-5 w-5" />
                                    <span>Sao chép ảnh</span>
                                </>
                            )}
                        </button>
                        <button 
                            onClick={handleDownloadImage}
                            disabled={isDownloading} 
                            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-md shadow-sm text-base font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors disabled:bg-teal-400"
                        >
                            <DownloadIcon className="h-5 w-5" />
                            <span>{isDownloading ? 'Đang tải...' : 'Tải xuống'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareReportModal;