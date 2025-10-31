import React, { useState, useEffect, useRef } from 'react';
import { Certificate, UserData } from '../App';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import CameraIcon from './icons/CameraIcon';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import CameraModal from './CameraModal';
import { uploadToDrive, transformGoogleDriveUrl, blobToBase64, deleteFromDrive } from '../utils/driveUploader';

interface CertificateEditModalProps {
  user: UserData;
  certificate: Certificate;
  onSave: (updatedData: Partial<Certificate>) => void;
  onClose: () => void;
  geminiApiKey: string | null;
}

const CertificateEditModal: React.FC<CertificateEditModalProps> = ({ user, certificate, onSave, onClose, geminiApiKey }) => {
  const [formData, setFormData] = useState({
    name: '',
    credits: '',
    date: '',
    imageUrl: '',
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [newlyUploadedFileId, setNewlyUploadedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setFormData({
      name: certificate.name || '',
      credits: certificate.credits?.toString() || '',
      date: certificate.date ? certificate.date.toDate().toISOString().split('T')[0] : '',
      imageUrl: certificate.imageUrl || '',
    });
    if (certificate.imageUrl) {
        setImagePreviewUrl(transformGoogleDriveUrl(certificate.imageUrl));
    }
  }, [certificate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const validate = (): { [key: string]: string } => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Tên chứng chỉ không được để trống.';
    const creditsValue = parseFloat(formData.credits);
    if (isNaN(creditsValue) || creditsValue <= 0) newErrors.credits = 'Số tiết phải là một số lớn hơn 0.';
    if (!formData.date) {
        newErrors.date = 'Ngày cấp không được để trống.';
    } else {
        const selectedDate = new Date(formData.date + 'T00:00:00.000Z');
        const minDate = new Date('2021-01-01T00:00:00.000Z');
        const today = new Date();
        today.setUTCHours(23, 59, 59, 999);
        if (selectedDate < minDate) newErrors.date = 'Ngày cấp không được trước ngày 01/01/2021.';
        if (selectedDate > today) newErrors.date = 'Ngày cấp không được là một ngày trong tương lai.';
    }
    if (!formData.imageUrl.trim()) newErrors.imageUrl = 'Phải có ảnh chứng chỉ.';
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
    }
    setErrors({});
    const dataToSave = {
      name: formData.name.trim(),
      credits: parseFloat(formData.credits),
      imageUrl: formData.imageUrl.trim(),
      date: new Date(formData.date + 'T00:00:00.000Z'),
    };
    onSave(dataToSave as unknown as Partial<Certificate>);
  };

  const handleClose = async () => {
    if (isProcessing || isClosing) return;
    if (newlyUploadedFileId) {
        setIsClosing(true);
        console.log(`Cancelling edit... Deleting new temporary file: ${newlyUploadedFileId}`);
        try {
            await deleteFromDrive(newlyUploadedFileId);
        } catch (error) {
            console.error("Failed to delete temporary file on close:", error);
        } finally {
            onClose();
        }
    } else {
        onClose();
    }
  };

   const processNewImage = async (imageBlob: Blob) => {
    const MAX_FILE_SIZE_MB = 10;
    if (imageBlob.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setErrors(prev => ({ ...prev, imageUrl: `Lỗi: Kích thước tệp quá lớn (tối đa ${MAX_FILE_SIZE_MB}MB).` }));
        return;
    }

    if (!geminiApiKey) {
        setErrors(prev => ({ ...prev, imageUrl: "Lỗi: Chưa cấu hình API Key. Vui lòng liên hệ quản trị viên."}));
        return;
    }

    if (newlyUploadedFileId) {
        await deleteFromDrive(newlyUploadedFileId);
        setNewlyUploadedFileId(null);
    }

    setIsProcessing(true);
    setErrors({});
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(imageBlob));

    try {
        setProcessingMessage('Đang tải ảnh lên...');
        
        const uploadResult = await uploadToDrive(imageBlob, user.username);

        if (!uploadResult.success || !uploadResult.id || !uploadResult.url) {
            throw new Error(uploadResult.error || "Tải ảnh lên Google Drive thất bại.");
        }
        
        setNewlyUploadedFileId(uploadResult.id);
        const downloadURL = uploadResult.url;
        
        setFormData(prev => ({...prev, imageUrl: downloadURL }));
        if (errors.imageUrl) setErrors(prev => ({ ...prev, imageUrl: '' }));

        setProcessingMessage('Đang trích xuất dữ liệu...');
        const base64Data = await blobToBase64(imageBlob);
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        
        const systemInstruction = `Vai trò: Bạn là một AI chuyên gia trích xuất dữ liệu, được đào tạo đặc biệt để phân tích hình ảnh chứng chỉ đào tạo y khoa liên tục (CME/CPD) bằng tiếng Việt.
Nhiệm vụ: Nhiệm vụ của bạn là trích xuất chính xác các thông tin cụ thể từ hình ảnh chứng chỉ được cung cấp và trả về dưới dạng một đối tượng JSON.
Đầu ra: Chỉ trả về một đối tượng JSON hợp lệ theo cấu trúc sau. TUYỆT ĐỐI không thêm bất kỳ văn bản giải thích, lời chào đầu/kết hay định dạng markdown nào khác.
\`\`\`json
{
  "name": "string | null",
  "date": "string (YYYY-MM-DD) | null",
  "credits": "number | null"
}
\`\`\`
Hướng dẫn chi tiết: Trích xuất tiêu đề chính (name), ngày kết thúc sự kiện (date), và số tiết học (credits). Luôn trả về ngày theo định dạng YYYY-MM-DD. Nếu không chắc, trả về null.`;

        const genAIResponse: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [ { parts: [{ inlineData: { mimeType: imageBlob.type, data: base64Data } }] } ],
            config: { responseMimeType: "application/json", systemInstruction }
        });
        
        const responseText = genAIResponse.text.trim();
        if (!responseText || responseText.toLowerCase() === 'null') {
            throw new Error("AI returned an empty or null response.");
        }
        
        const extractedData = JSON.parse(responseText);
        let dataExtracted = false;

        if (extractedData) {
            const updates: Partial<typeof formData> = {};

            if (extractedData.name && typeof extractedData.name === 'string' && extractedData.name.toLowerCase() !== 'null') {
                updates.name = extractedData.name;
                dataExtracted = true;
            }
            if (extractedData.credits && typeof extractedData.credits === 'number') {
                updates.credits = extractedData.credits.toString();
                dataExtracted = true;
            }
            if (extractedData.date && typeof extractedData.date === 'string') {
                updates.date = extractedData.date;
                dataExtracted = true;
            }
            
            if (Object.keys(updates).length > 0) {
                setFormData(prev => ({ ...prev, ...updates }));
            }
            
            if (!dataExtracted) {
                throw new Error("AI could not extract any valid information.");
            }
        }
    } catch (error) {
        console.error("Error processing image:", error);
        setErrors(prev => ({ ...prev, imageUrl: 'Phần mềm không lấy được dữ liệu, đề nghị nhập liệu bằng tay.' }));
    } finally {
        setIsProcessing(false);
        setProcessingMessage('');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processNewImage(file);
    }
  };

  const handlePhotoTaken = (imageBlob: Blob) => {
      setIsCameraOpen(false);
      processNewImage(imageBlob);
  }

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
            <h2 className="text-2xl font-bold text-teal-800">Chỉnh sửa chứng chỉ</h2>
            <button onClick={handleClose} disabled={isClosing} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-wait" aria-label="Đóng">
                <CloseIcon className="h-6 w-6" />
            </button>
        </header>
        
        <main className="p-6 flex-grow overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <div className="md:col-span-2 space-y-4">
                    <h3 className="text-base font-medium text-gray-700">Hình ảnh chứng chỉ</h3>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    
                    <div 
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                        className={`relative w-full aspect-[4/3] bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden text-center transition-colors ${!isProcessing ? 'cursor-pointer hover:bg-slate-100 hover:border-teal-400' : 'cursor-default'}`}
                        role="button"
                        aria-label="Thay đổi ảnh"
                    >
                        {imagePreviewUrl ? (
                             <img src={imagePreviewUrl} alt="Xem trước chứng chỉ" className="w-full h-full object-contain" />
                        ) : (
                            <div className="p-4">
                                <UploadIcon className="h-10 w-10 text-slate-400 mx-auto" />
                                <p className="text-slate-500 text-base mt-2">Không có hình ảnh</p>
                            </div>
                        )}
                         {isProcessing && (
                            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-semibold text-teal-700">{processingMessage}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex-1 btn-secondary-outline justify-center gap-2">
                            <UploadIcon className="h-5 w-5" />
                            Chọn từ tệp
                        </button>
                        <button type="button" onClick={() => setIsCameraOpen(true)} disabled={isProcessing} className="flex-1 btn-secondary-outline justify-center gap-2">
                           <CameraIcon className="h-5 w-5" />
                           Chụp ảnh
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="md:col-span-3 space-y-6 flex flex-col">
                    <div className="flex-grow space-y-5">
                        <div>
                            <label htmlFor="name" className="block text-base font-medium text-gray-700">Tên chứng chỉ</label>
                            <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} className={`mt-1 w-full input-style ${errors.name ? 'border-red-500' : 'border-slate-300'}`} />
                            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                            <label htmlFor="credits" className="block text-base font-medium text-gray-700">Số tiết</label>
                            <input id="credits" name="credits" type="number" step="0.1" value={formData.credits} onChange={handleChange} className={`mt-1 w-full input-style ${errors.credits ? 'border-red-500' : 'border-slate-300'}`} />
                            {errors.credits && <p className="text-sm text-red-500 mt-1">{errors.credits}</p>}
                            </div>
                            <div>
                            <label htmlFor="date" className="block text-base font-medium text-gray-700">Ngày cấp</label>
                            <input id="date" name="date" type="date" value={formData.date} onChange={handleChange} className={`mt-1 w-full input-style ${errors.date ? 'border-red-500' : 'border-slate-300'}`} />
                            {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="imageUrl" className="block text-base font-medium text-gray-700">URL Ảnh</label>
                            <input id="imageUrl" name="imageUrl" type="text" value={formData.imageUrl} readOnly placeholder="Sẽ tự động điền sau khi tải ảnh lên" className={`mt-1 w-full input-style bg-slate-100 cursor-not-allowed ${errors.imageUrl ? 'border-red-500' : 'border-slate-300'}`} />
                            {errors.imageUrl && <p className="text-sm text-red-500 mt-1">{errors.imageUrl}</p>}
                        </div>
                    </div>
                </form>
            </div>
        </main>
        <footer className="px-6 py-4 border-t border-slate-200 flex justify-end space-x-3 flex-shrink-0">
            <button type="button" onClick={handleClose} disabled={isProcessing || isClosing} className="btn-secondary">{isClosing ? 'Đang huỷ...' : 'Hủy'}</button>
            <button type="submit" onClick={handleSubmit} disabled={isProcessing || isClosing} className="btn-primary">Lưu thay đổi</button>
        </footer>
      </div>
       <style>{`
        .input-style { box-sizing: border-box; width: 100%; margin-top: 0.25rem; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; }
        .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; --tw-ring-color: #14B8A6; box-shadow: 0 0 0 2px var(--tw-ring-color); border-color: #14B8A6; }
        .btn-primary { background-color: #0D9488; color: white; font-weight: 600; padding: 0.625rem 1.25rem; border-radius: 0.5rem; transition: background-color 0.2s; border: none; }
        .btn-primary:hover { background-color: #0F766E; } .btn-primary:disabled { background-color: #5EEAD4; cursor: not-allowed; }
        .btn-secondary { background-color: #E5E7EB; color: #374151; font-weight: 600; padding: 0.625rem 1.25rem; border-radius: 0.5rem; transition: background-color 0.2s; border: none; }
        .btn-secondary:hover { background-color: #D1D5DB; } .btn-secondary:disabled { background-color: #F3F4F6; cursor: not-allowed; }
        .btn-secondary-outline { display: flex; align-items: center; background-color: #FFFFFF; color: #374151; font-weight: 600; padding: 0.5rem 1rem; border-radius: 0.5rem; transition: all 0.2s; border: 1px solid #D1D5DB; }
        .btn-secondary-outline:hover { background-color: #F9FAFB; border-color: #6B7280; } .btn-secondary-outline:disabled { background-color: #F3F4F6; cursor: not-allowed; opacity: 0.7; }
      `}</style>
    </div>
    {isCameraOpen && <CameraModal onCapture={handlePhotoTaken} onClose={() => setIsCameraOpen(false)} />}
    </>
  );
};

export default CertificateEditModal;