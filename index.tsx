import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Chart, registerables, ChartType } from 'chart.js';
import { Report, ReportViewer } from "./Report";
import "./report.css";
Chart.register(...registerables);

// For Excel export
declare var XLSX: any;
// For EXIF data reading
declare var EXIF: any;


// --- Type definitions ---
interface User {
  id: number;
  username: string;
  password?: string;
  role: 'user' | 'admin' | 'reporter' | 'reporter_user';
  name: string;
  department: string;
  passwordChangedAt?: string;
  dateOfBirth?: string;
  position?: string;
  title?: string; // This will now store the ID of the title
  practiceCertificateNumber?: string;
  practiceCertificateIssueDate?: string;
  isSuspended?: boolean;
}
type NewUser = Omit<User, 'id'>;

interface Title {
    id: number;
    name: string;
}

interface Certificate {
  id: number;
  userId: number;
  name: string;
  date: string;
  credits: number;
  image: string;
  imageId: string;
  updatedAt?: string;
  imageOrientation?: number;
}

// Used when creating a new certificate, before it's saved and gets an ID.
interface NewCertificatePayload {
    name: string;
    date: string;
    credits: number;
    imageFile: File; // We use the File object for the "upload"
    orientation: number;
}

interface ReportGroup {
    groupTitle: string;
    rows: (string | number)[][];
}

interface DetailedRowUser {
    name: string;
    totalCredits: number;
    certificates: { name: string; credits: number }[];
}

interface ReportData {
    title: string;
    headers: string[];
    rows?: (string | number)[][];
    groups?: ReportGroup[];
    detailedRows?: DetailedRowUser[];
}

// Helper function to format date strings for display (dd/mm/yyyy).
const formatDateForDisplay = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Chưa cập nhật';
    // The date constructor handles 'YYYY-MM-DD' and full ISO strings like '2023-10-27T00:00:00' correctly.
    // We add 'T00:00:00' to treat 'YYYY-MM-DD' as a local date, then use UTC methods to prevent timezone shifts.
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    if (isNaN(date.getTime())) {
        return 'Ngày không hợp lệ';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// ===================================================================================
//
//                              REAL API LAYER
//   These functions now make real network requests to our Google Apps Script backend.
//
// ===================================================================================

// !!! IMPORTANT: PASTE YOUR DEPLOYED WEB APP URL HERE
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzSh3oyhzNh-NGm2lGxoP0CqMJjpsV9FZYlt443T0XDf91GsdUfSAU68P-OlEuJo6xtJw/exec'; 

const api = {
    // Helper function to handle fetch requests
    request: async (method: 'GET' | 'POST', action?: string, payload?: any) => {
        if (!BACKEND_URL) {
            alert('Lỗi cấu hình: Vui lòng dán URL của Google Apps Script Web App vào biến BACKEND_URL trong file index.tsx.');
            throw new Error("Backend URL not configured.");
        }

        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // Required for Apps Script
            },
            redirect: 'follow',
        };

        if (method === 'POST') {
            options.body = JSON.stringify({ action, payload });
        }
        
        try {
            const response = await fetch(BACKEND_URL + (method === 'GET' ? '?action=fetchInitialData' : ''), options);
            const result = await response.json();

            if (!result.success) {
                console.error("API Error:", result.message);
                throw new Error(result.message || 'An unknown API error occurred.');
            }
            
            return result.data;

        } catch (error) {
            console.error(`API request failed for action: ${action}`, error);
            throw error;
        }
    },

    // Helper to convert a file to a base64 string
    fileToBase64: (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    },

    // FETCH initial (lightweight) data
    fetchInitialData: async (): Promise<{ users: User[], titles: Title[], googleSheetUrl: string, googleFolderUrl: string, complianceStartYear: number }> => {
        return api.request('GET', 'fetchInitialData');
    },

    // FETCH heavy data (certificates) separately
    fetchCertificates: async (): Promise<Certificate[]> => {
        return api.request('POST', 'fetchCertificates');
    },

    // AUTHENTICATION
    login: async (username: string, password: string): Promise<{ loggedInUser: User, users: User[], titles: Title[], googleSheetUrl: string, googleFolderUrl: string, complianceStartYear: number }> => {
        return api.request('POST', 'login', { username, password });
    },
    
    changePassword: async (userId: number, oldPassword: string, newPassword: string): Promise<{success: boolean, message: string}> => {
        const payload = {
            userId,
            oldPassword,
            newPassword,
            passwordChangedAt: new Date().toISOString()
        };
        return api.request('POST', 'changePassword', payload);
    },

    // CERTIFICATES
    addCertificate: async (certData: NewCertificatePayload, userId: number, userName: string): Promise<Certificate> => {
        const imageBase64 = await api.fileToBase64(certData.imageFile);
        
        const now = new Date();
        const dateStr = now.getFullYear().toString() + 
                        (now.getMonth() + 1).toString().padStart(2, '0') + 
                        now.getDate().toString().padStart(2, '0');
        const timeStr = now.getHours().toString().padStart(2, '0') + 
                        now.getMinutes().toString().padStart(2, '0') + 
                        now.getSeconds().toString().padStart(2, '0');
        const extension = certData.imageFile.name.split('.').pop() || 'jpg';
        const newImageName = `${userName.replace(/\s/g, '_')}_${dateStr}_${timeStr}.${extension}`;
        
        const payload = {
            id: Date.now(),
            userId,
            userName, // Pass userName for logging
            name: certData.name,
            date: certData.date,
            credits: certData.credits,
            imageName: newImageName,
            imageType: certData.imageFile.type,
            imageBase64,
            orientation: certData.orientation,
        };
        return api.request('POST', 'addCertificate', payload);
    },
    updateCertificate: async (payload: any): Promise<Certificate> => {
        const payloadWithTimestamp = { ...payload, updatedAt: new Date().toISOString() };
        return api.request('POST', 'updateCertificate', payloadWithTimestamp);
    },
    updateCertificateOrientation: async (id: number, orientation: number): Promise<Certificate> => {
        return api.request('POST', 'updateCertificateOrientation', { id, orientation });
    },
    deleteCertificate: async (id: number, modifiedByUserId: number): Promise<number> => {
        return api.request('POST', 'deleteCertificate', { id, modifiedByUserId });
    },
    
    // USERS
    addUser: async (newUser: NewUser): Promise<User> => {
        return api.request('POST', 'addUser', newUser);
    },
    updateUser: async (updatedUser: User): Promise<User> => {
        return api.request('POST', 'updateUser', updatedUser);
    },
    deleteUser: async (userId: number): Promise<number> => {
        return api.request('POST', 'deleteUser', { userId });
    },

    // SETTINGS
    updateComplianceYear: async (year: number): Promise<{ newYear: number }> => {
        return api.request('POST', 'updateComplianceYear', { year });
    },
};
// ===================================================================================
//
//                              REACT COMPONENTS
//                     (No changes needed in this section)
//
// ===================================================================================

const getRotationFromExif = (orientation: number | undefined): number => {
    switch (orientation) {
        case 3:
            return 180;
        case 6:
            return 90;
        case 8:
            return -90; // 270 degrees clockwise
        default:
            return 0;
    }
};

// Helper function to normalize text for searching (remove accents, lowercase)
const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const isUserCompliant = (user: User, credits: number, titles: Title[]): { compliant: boolean; required: number } => {
    const titleName = titles.find(t => String(t.id) === String(user.title))?.name || '';
    const isPharmacist = titleName && normalizeText(titleName).includes('duoc si');
    const requiredCredits = isPharmacist ? 8 : 120;
    return {
        compliant: credits >= requiredCredits,
        required: requiredCredits,
    };
};

const ConfirmationModal = ({ message, onConfirm, onCancel, confirmText = 'Xác nhận', cancelText = 'Hủy' }: { message: string, onConfirm: () => void, onCancel: () => void, confirmText?: string, cancelText?: string }) => {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Xác nhận</h2>
                <p style={{ margin: '20px 0', fontSize: '16px', lineHeight: '1.5' }}>{message}</p>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
                    <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const ImageViewerModal = ({ certificate, onClose, onSaveRotation }: { certificate: Certificate; onClose: () => void; onSaveRotation: (certId: number, orientation: number) => void; }) => {
    const initialOrientation = certificate.imageOrientation || 1;
    const [currentOrientation, setCurrentOrientation] = useState(initialOrientation);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const orientationToRotationMap: { [key: number]: number } = { 1: 0, 6: 90, 3: 180, 8: 270 };
    const rotationToOrientationMap: { [key: number]: number } = { 0: 1, 90: 6, 180: 3, 270: 8 };

    const handleRotate = (direction: 'cw' | 'ccw') => {
        const currentRotation = orientationToRotationMap[currentOrientation] || 0;
        const newRotation = direction === 'cw'
            ? (currentRotation + 90) % 360
            : (currentRotation - 90 + 360) % 360;
        setCurrentOrientation(rotationToOrientationMap[newRotation] || 1);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSaveRotation(certificate.id, currentOrientation);
            onClose();
        } catch (error) {
            console.error("Failed to save rotation", error);
            alert("Lỗi: Không thể lưu hướng xoay.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const rotationDegrees = getRotationFromExif(currentOrientation);
    const hasChanged = currentOrientation !== initialOrientation;

    return (
        <div className="modal-overlay image-viewer-overlay" onClick={onClose}>
            <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
                <button className="image-viewer-close-btn" onClick={onClose} title="Đóng (Esc)">
                    <span className="material-icons">close</span>
                </button>
                <div className="image-viewer-toolbar">
                    <button onClick={() => handleRotate('ccw')} title="Xoay trái"><span className="material-icons">rotate_left</span></button>
                    <button onClick={() => handleRotate('cw')} title="Xoay phải"><span className="material-icons">rotate_right</span></button>
                    {hasChanged && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                            <span className="material-icons">{isSaving ? 'hourglass_top' : 'save'}</span>
                            {isSaving ? 'Đang lưu...' : 'Lưu hướng xoay'}
                        </button>
                    )}
                </div>
                <img 
                    src={certificate.image} 
                    alt="Phóng to hình ảnh chứng chỉ" 
                    style={{ transform: `rotate(${rotationDegrees}deg)` }}
                />
            </div>
        </div>
    );
};


const LoginPage = ({ onLogin, error }: { onLogin: (username: string, password: string) => void, error: string }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="login-card">
      <div className="login-logo-container">
        <img src="https://lh3.googleusercontent.com/d/1g1UAdHK6dUS3PQumDP0-LFN1-zZnm5-p" alt="Logo" className="login-logo-img" />
      </div>
      <h1 className="login-title">HỆ THỐNG QUẢN LÝ<br />ĐÀO TẠO LIÊN TỤC</h1>
      <p className="login-prompt">Vui lòng đăng nhập để tiếp tục.</p>

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="username">Tên đăng nhập</label>
          <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mật khẩu</label>
          <div className="password-input-wrapper">
            <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                <span className="material-icons">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-group-center">
          <button type="submit" className="btn btn-primary">Đăng nhập</button>
        </div>
      </form>
    </div>
  );
};

const EditCertificateModal = ({ certificate, onSave, onCancel }: { certificate: Certificate, onSave: (data: Certificate, newImageFile?: File, newImageOrientation?: number) => void, onCancel: () => void }) => {
    const [formData, setFormData] = useState({
        name: certificate.name,
        date: certificate.date || '',
        credits: certificate.credits.toString()
    });
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [imageOrientation, setImageOrientation] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);
    const [error, setError] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingCurrent, setIsExtractingCurrent] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        if (file) {
            setNewImageFile(file);
            const objectUrl = URL.createObjectURL(file);
            setImagePreviewUrl(objectUrl);
            
            // Read EXIF data for auto-rotation
            EXIF.getData(file, function() {
                const orientation = EXIF.getTag(this, "Orientation") || 1;
                setImageOrientation(orientation);
                const rotation = getRotationFromExif(orientation);
                setImageRotation(rotation);
            });
        }
    };
    
    const applyExtractionResult = (result: any) => {
        if (result && (result.name || result.date || result.credits)) {
            // Update form data only with fields that the AI found
            setFormData(prev => ({
                ...prev,
                name: result.name || prev.name,
                date: result.date || prev.date,
                credits: result.credits ? String(result.credits) : prev.credits,
            }));
            setExtractionStatus('Đã trích xuất và cập nhật thông tin!');
        } else {
            setExtractionStatus('Tôi không thể lấy thông tin từ hình ảnh bạn cung cấp, vui lòng nhập thủ công');
        }
    };

    const handleExtractFromNewImage = async () => {
        if (!newImageFile) return;

        setIsExtracting(true);
        setExtractionStatus('Đang phân tích ảnh mới...');
        try {
            const reader = new FileReader();
            reader.readAsDataURL(newImageFile);
            reader.onloadend = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                const result = await api.request('POST', 'extractCertificateInfo', {
                    imageBase64: base64Data,
                    imageType: newImageFile.type,
                });
                applyExtractionResult(result);
            };
        } catch (error: any) {
            console.error("AI Extraction Error (New Image):", error);
            setExtractionStatus(error.message || 'Lỗi: Không thể trích xuất thông tin.');
        } finally {
            setIsExtracting(false);
        }
    };
    
    const handleExtractFromCurrentImage = async () => {
        if (!certificate.imageId) {
            setExtractionStatus('Lỗi: Không tìm thấy ID hình ảnh cho chứng chỉ này.');
            return;
        }
        setIsExtractingCurrent(true);
        setExtractionStatus('Đang phân tích ảnh hiện tại...');
        try {
            const result = await api.request('POST', 'extractFromImageId', {
                imageId: certificate.imageId,
            });
            applyExtractionResult(result);
        } catch (error: any) {
            console.error("AI Extraction Error (Current Image):", error);
            setExtractionStatus(error.message || 'Lỗi: Không thể trích xuất thông tin.');
        } finally {
            setIsExtractingCurrent(false);
        }
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to midnight to compare dates only
        const selectedDate = new Date(formData.date + 'T00:00:00'); // Ensure it's parsed as local midnight

        if (selectedDate > today) {
            setError("Ngày cấp không được lớn hơn ngày hiện tại.");
            return;
        }

        if (selectedDate.getFullYear() < 2021) {
            setError("Ngày cấp không được trước năm 2021.");
            return;
        }
        
        if (!formData.name.trim() || !formData.date || !formData.credits.trim()) {
            setError("Vui lòng điền đầy đủ các trường bắt buộc: Tên chứng chỉ, Ngày cấp, Số tiết.");
            return;
        }
        if (parseFloat(formData.credits) <= 0) {
            setError("Số tiết phải là một số dương (lớn hơn 0).");
            return;
        }
        onSave({
            ...certificate,
            name: formData.name.trim(),
            date: formData.date,
            credits: parseFloat(formData.credits) || 0
        }, newImageFile, imageOrientation);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Sửa thông tin chứng chỉ</h2>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label htmlFor="modal-cert-name">Tên chứng chỉ</label>
                        <input type="text" id="modal-cert-name" name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-cert-date">Ngày cấp</label>
                        <input type="date" id="modal-cert-date" name="date" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="modal-cert-credits">Số tiết</label>
                        <input type="number" step="0.1" id="modal-cert-credits" name="credits" value={formData.credits} onChange={handleChange} required min="0.1" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="modal-cert-image">Hình ảnh (tùy chọn)</label>
                        <input 
                            type="file" 
                            id="modal-cert-image" 
                            accept="image/*" 
                            onChange={handleImageChange} 
                            style={{ display: 'none' }} 
                            ref={fileInputRef} 
                        />
                        <div className="modal-image-actions">
                            <button type="button" className="btn" style={{background: '#f0f4f8', color: '#333'}} onClick={() => fileInputRef.current?.click()}>
                                <span className="material-icons">upload_file</span> Chọn ảnh mới
                            </button>
                             {certificate.image && (
                                <button type="button" className="btn" onClick={handleExtractFromCurrentImage} disabled={isExtractingCurrent || isExtracting}>
                                    <span className="material-icons">{isExtractingCurrent ? 'hourglass_top' : 'smart_toy'}</span>
                                    {isExtractingCurrent ? 'Đang trích xuất...' : 'Trích xuất từ ảnh hiện tại'}
                                </button>
                            )}
                            {newImageFile && (
                                <button type="button" className="btn" onClick={handleExtractFromNewImage} disabled={isExtracting || isExtractingCurrent}>
                                    <span className="material-icons">{isExtracting ? 'hourglass_top' : 'smart_toy'}</span>
                                    {isExtracting ? 'Đang trích xuất...' : 'Trích xuất từ ảnh mới'}
                                </button>
                            )}
                           
                        </div>
                        {(imagePreviewUrl || certificate.image) && (
                            <div className="image-preview" style={{ marginTop: '10px' }}>
                                <img 
                                    src={imagePreviewUrl || certificate.image} 
                                    alt="Xem trước" 
                                    style={{
                                        transform: imagePreviewUrl ? `rotate(${imageRotation}deg)` : `rotate(${getRotationFromExif(certificate.imageOrientation)}deg)`
                                    }}
                                />
                            </div>
                        )}
                         {extractionStatus && <p className={`extraction-status ${extractionStatus.startsWith('Lỗi') || extractionStatus.startsWith('Tôi không thể') ? 'error' : ''}`}>{extractionStatus}</p>}
                    </div>
                    {error && <p className="error" style={{textAlign: 'left', minHeight: '0', marginBottom: '16px'}}>{error}</p>}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
                        <button type="submit" className="btn btn-primary">Lưu thay đổi</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ChangePasswordModal = ({ onSave, onCancel, userId, isForced = false }: { onSave: (userId: number, oldPass: string, newPass: string) => Promise<void>, onCancel: () => void, userId: number, isForced?: boolean }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu mới không khớp.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }
        setIsSaving(true);
        try {
            await onSave(userId, oldPassword, newPassword);
            if (!isForced) {
                onCancel(); // Close modal on success only if not forced
            }
        } catch(err: any) {
             setError(err.message || "Đã xảy ra lỗi.");
             setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={isForced ? undefined : onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{isForced ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu'}</h2>
                {isForced && <p className="forced-change-message">Đây là lần đăng nhập đầu tiên hoặc mật khẩu của bạn đã được reset. Vui lòng tạo mật khẩu mới để tiếp tục.</p>}
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label htmlFor="old-password">Mật khẩu {isForced ? 'tạm thời' : 'cũ'}</label>
                        <div className="password-input-wrapper">
                            <input type={showOldPassword ? 'text' : 'password'} id="old-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                            <button type="button" className="password-toggle-btn" onClick={() => setShowOldPassword(!showOldPassword)} title={showOldPassword ? "Ẩn" : "Hiện"}>
                                <span className="material-icons">{showOldPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="new-password">Mật khẩu mới</label>
                        <div className="password-input-wrapper">
                            <input type={showNewPassword ? 'text' : 'password'} id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                            <button type="button" className="password-toggle-btn" onClick={() => setShowNewPassword(!showNewPassword)} title={showNewPassword ? "Ẩn" : "Hiện"}>
                                <span className="material-icons">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
                        <div className="password-input-wrapper">
                            <input type={showConfirmPassword ? 'text' : 'password'} id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                            <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} title={showConfirmPassword ? "Ẩn" : "Hiện"}>
                                <span className="material-icons">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>
                    {error && <p className="error" style={{textAlign: 'left', minHeight: '0'}}>{error}</p>}
                    <div className="modal-actions">
                        {!isForced && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>Hủy</button>}
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

type ViewMode = 'grid' | 'list' | 'timeline';

const MultiSelector = ({ allItems, selectedItems, onSelectionChange, placeholder, itemValue = 'id', itemLabel = 'name' }: { allItems: any[], selectedItems: string[], onSelectionChange: (items: string[]) => void, placeholder: string, itemValue?: string, itemLabel?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleItemToggle = (item: any) => {
        const value = String(item[itemValue]);
        const newSelection = selectedItems.includes(value)
            ? selectedItems.filter(i => i !== value)
            : [...selectedItems, value];
        onSelectionChange(newSelection);
    };

    const handleSelectAll = () => { onSelectionChange(allItems.map(i => String(i[itemValue]))); };
    const handleDeselectAll = () => { onSelectionChange([]); };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const displayLabel = useMemo(() => {
        if (selectedItems.length === 0 || selectedItems.length === allItems.length) {
            return `Tất cả (${placeholder})`;
        }
        return selectedItems
            .map(sel => allItems.find(item => String(item[itemValue]) === sel)?.[itemLabel] || sel)
            .join(', ');
    }, [selectedItems, allItems, placeholder, itemValue, itemLabel]);

    return (
        <div className="multi-select-container" ref={wrapperRef}>
            <button type="button" className="multi-select-button" onClick={() => setIsOpen(!isOpen)}>
                <span>{displayLabel}</span>
                <span className="material-icons">arrow_drop_down</span>
            </button>
            {isOpen && (
                <div className="multi-select-dropdown">
                    <div className="multi-select-actions">
                        <button type="button" onClick={handleSelectAll}>Tất cả</button>
                        <button type="button" onClick={handleDeselectAll}>Bỏ chọn</button>
                    </div>
                    {allItems.map(item => (
                        <label key={item[itemValue]}>
                            <input
                                type="checkbox"
                                checked={selectedItems.includes(String(item[itemValue]))}
                                onChange={() => handleItemToggle(item)}
                            />
                            {item[itemLabel]}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileTab = ({ certificates, user, onDeleteCertificate, onUpdateCertificate, onUpdateCertificateOrientation }: { certificates: Certificate[], user: User, onDeleteCertificate: (id: number) => void, onUpdateCertificate: (cert: Certificate, newImageFile?: File, newImageOrientation?: number) => void, onUpdateCertificateOrientation: (certId: number, orientation: number) => void }) => {
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
    const [confirmation, setConfirmation] = useState<{message: string, onConfirm: () => void} | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
    const [viewingImage, setViewingImage] = useState<Certificate | null>(null);

    const userCertificates = useMemo(() => {
        return certificates.filter(c => c.userId === user.id)
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }, [certificates, user.id]);

    const years = useMemo(() => {
        const allYears = userCertificates.map(c => new Date(c.date).getFullYear().toString());
        return [...new Set(allYears)].sort((a, b) => Number(b) - Number(a)).map(y => ({ id: y, name: y }));
    }, [userCertificates]);

    const filteredCertificates = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm);
        const searchWords = normalizedSearch.split(' ').filter(w => w);

        return userCertificates.filter(c => {
            const yearMatch = selectedYears.length === 0 || selectedYears.includes(new Date(c.date).getFullYear().toString());
            
            if (!yearMatch) return false;
            if (searchWords.length === 0) return true;

            const normalizedCertName = normalizeText(c.name);
            
            // Check if all search words are present in the certificate name
            const searchMatch = searchWords.every(word => normalizedCertName.includes(word));
            
            return searchMatch;
        });
    }, [userCertificates, selectedYears, searchTerm]);
    
    const totalCredits = useMemo(() => {
        // FIX: Explicitly convert credits to a number during summation to prevent type errors.
        const sum = filteredCertificates.reduce((acc: number, cert) => acc + Number(cert.credits || 0), 0);
        return Number.isInteger(sum) ? sum : sum.toFixed(1);
    }, [filteredCertificates]);
    
    const handleViewImage = (e: React.MouseEvent, cert: Certificate) => {
        e.stopPropagation();
        setViewingImage(cert);
    };

    const handleDelete = (e: React.MouseEvent, certId: number, certName: string) => {
        e.stopPropagation(); 
        setConfirmation({
            message: `Bạn có chắc chắn muốn xóa chứng chỉ "${certName}" không?`,
            onConfirm: () => onDeleteCertificate(certId)
        });
    };
    
    const handleEdit = (e: React.MouseEvent, cert: Certificate) => {
        e.stopPropagation();
        setEditingCertificate(cert);
    };

    const handleSaveCertificate = (updatedCert: Certificate, newImageFile?: File, newImageOrientation?: number) => {
        onUpdateCertificate(updatedCert, newImageFile, newImageOrientation);
        setEditingCertificate(null);
    };
    
    const handleConfirmAction = () => {
        if (confirmation) {
            confirmation.onConfirm();
            setConfirmation(null);
        }
    };
    
    const renderContent = () => {
        if (filteredCertificates.length === 0) {
            return <div className="no-results"><p>Không tìm thấy chứng chỉ nào phù hợp.</p></div>;
        }

        switch (viewMode) {
            case 'list':
                return (
                    <div className="certificates-list">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tên chứng chỉ</th>
                                    <th>Ngày cấp</th>
                                    <th>Số tiết</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCertificates.map(cert => (
                                    <React.Fragment key={cert.id}>
                                        <tr onClick={() => setExpandedRowId(prev => (prev === cert.id ? null : cert.id))}>
                                            <td>{cert.name}</td>
                                            <td>{formatDateForDisplay(cert.date)}</td>
                                            <td>{cert.credits}</td>
                                            <td>
                                                <div className="certificate-actions" style={{justifyContent: 'flex-start'}}>
                                                    <button className="btn-icon" title="Sửa" onClick={(e) => handleEdit(e, cert)}><span className="material-icons">edit</span></button>
                                                    <button className="btn-icon btn-delete" title="Xóa" onClick={(e) => handleDelete(e, cert.id, cert.name)}><span className="material-icons">delete</span></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRowId === cert.id && (
                                            <tr className="expanded-image-row">
                                                <td colSpan={4}>
                                                    <div className="expanded-image">
                                                        <img 
                                                            src={cert.image || 'https://via.placeholder.com/600x400.png?text=Kh%C3%B4ng+th%E1%BB%83+t%E1%BA%A3i+%E1%BA%A3nh'} 
                                                            alt={cert.name} 
                                                            style={{ transform: `rotate(${getRotationFromExif(cert.imageOrientation)}deg)` }}
                                                            onClick={(e) => cert.image && handleViewImage(e, cert)}
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.onerror = null; // prevent infinite loop
                                                                target.src='https://via.placeholder.com/600x400.png?text=Kh%C3%B4ng+th%E1%BB%83+t%E1%BA%A3i+%E1%BA%A3nh';
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'timeline':
                return (
                    <div className="certificates-timeline">
                        <div className="timeline-line"></div>
                        {filteredCertificates.map(cert => (
                            <div key={cert.id} className="timeline-item">
                                <div className="timeline-dot"></div>
                                <div className="timeline-item-content">
                                    <h3>{cert.name}</h3>
                                    <p><strong>Ngày cấp:</strong> {formatDateForDisplay(cert.date)}</p>
                                    <p><strong>Số tiết:</strong> {cert.credits}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'grid':
            default:
                return (
                    <div className="certificates-grid">
                        {filteredCertificates.map(cert => (
                            <div key={cert.id} className="certificate-card">
                                <img 
                                    src={cert.image || 'https://via.placeholder.com/400x250.png?text=Kh%C3%B4ng+th%E1%BB%83+t%E1%BA%A3i+%E1%BA%A3nh'} 
                                    alt={cert.name} 
                                    style={{ transform: `rotate(${getRotationFromExif(cert.imageOrientation)}deg)` }}
                                    onClick={(e) => cert.image && handleViewImage(e, cert)}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null; // prevent infinite loop
                                        target.src='https://via.placeholder.com/400x250.png?text=Kh%C3%B4ng+th%E1%BB%83+t%E1%BA%A3i+%E1%BA%A3nh';
                                    }}
                                />
                                <div className="certificate-info">
                                    <h3>{cert.name}</h3>
                                    <p><strong>Số tiết:</strong> {cert.credits}</p>
                                    <p><strong>Ngày cấp:</strong> {formatDateForDisplay(cert.date)}</p>
                                    <div className="certificate-actions">
                                        <button className="btn-icon" title="Sửa" onClick={(e) => handleEdit(e, cert)}><span className="material-icons">edit</span></button>
                                        <button className="btn-icon btn-delete" title="Xóa" onClick={(e) => handleDelete(e, cert.id, cert.name)}><span className="material-icons">delete</span></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
        }
    };

    return (
      <div>
        <div className="profile-header">
            <h2>Chứng chỉ của bạn</h2>
            <div className="profile-controls">
                <div className="filter-controls">
                    <div className="filter-group">
                        <label htmlFor="search-filter">Tìm kiếm:</label>
                        <input type="search" id="search-filter" placeholder="Tìm theo tên chứng chỉ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="filter-group">
                        <label>Năm:</label>
                        <div style={{ minWidth: '200px' }}>
                             <MultiSelector
                                allItems={years}
                                selectedItems={selectedYears}
                                onSelectionChange={setSelectedYears}
                                placeholder="Năm"
                            />
                        </div>
                    </div>
                    <div className="filter-group">
                        <label>Tổng tiết:</label>
                        <div className="total-credits-display">{totalCredits}</div>
                    </div>
                </div>
                <div className="view-switcher">
                    <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Xem dạng lưới"><span className="material-icons">grid_view</span></button>
                    <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="Xem dạng danh sách"><span className="material-icons">view_list</span></button>
                    <button className={viewMode === 'timeline' ? 'active' : ''} onClick={() => setViewMode('timeline')} title="Xem dạng dòng thời gian"><span className="material-icons">timeline</span></button>
                </div>
            </div>
        </div>
        
        {renderContent()}

        {editingCertificate && (
            <EditCertificateModal 
                certificate={editingCertificate}
                onSave={handleSaveCertificate}
                onCancel={() => setEditingCertificate(null)}
            />
        )}
        {confirmation && (
            <ConfirmationModal 
                message={confirmation.message}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmation(null)}
            />
        )}
        {viewingImage && (
            <ImageViewerModal 
                certificate={viewingImage}
                onClose={() => setViewingImage(null)}
                onSaveRotation={onUpdateCertificateOrientation}
            />
        )}
      </div>
    );
};

const DataEntryTab = ({ onAddCertificate }: { onAddCertificate: (cert: NewCertificatePayload) => Promise<void> }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [credits, setCredits] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [imageOrientation, setImageOrientation] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [confirmation, setConfirmation] = useState<{message: string, onConfirm: () => void} | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCancel = useCallback(() => {
        setName('');
        setDate('');
        setCredits('');
        setImageFile(null);
        setImageOrientation(1);
        setImageRotation(0);
        setStatusMessage('');
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    useEffect(() => {
        if (imageFile) {
            const objectUrl = URL.createObjectURL(imageFile);
            setImagePreviewUrl(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }
        setImagePreviewUrl(null);
    }, [imageFile]);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const processImageFile = async (file: File) => {
        if (!file) {
            setStatusMessage('');
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Đang phân tích hình ảnh...');
        setName(''); setDate(''); setCredits('');

        try {
            const base64Data = await blobToBase64(file);
            
            const result = await api.request('POST', 'extractCertificateInfo', {
                imageBase64: base64Data,
                imageType: file.type,
            });

            if (result && (result.name || result.date || result.credits)) {
                if (result.name) setName(result.name);
                if (result.date) setDate(result.date);
                if (result.credits) setCredits(String(result.credits));
                setStatusMessage('Đã trích xuất thông tin thành công!');
            } else {
                 setStatusMessage('Tôi không thể lấy thông tin từ hình ảnh bạn cung cấp, vui lòng nhập thủ công');
            }

        } catch (error: any) {
            console.error("AI Extraction Error:", error);
            setStatusMessage(error.message || 'Lỗi: Không thể trích xuất thông tin. Vui lòng nhập thủ công.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setImageFile(file);
        if (file) {
            // Read EXIF data for auto-rotation
            EXIF.getData(file, function() {
                const orientation = EXIF.getTag(this, "Orientation") || 1;
                setImageOrientation(orientation);
                const rotation = getRotationFromExif(orientation);
                setImageRotation(rotation);
            });
            processImageFile(file);
        }
    };

    const openCamera = async () => {
        setIsCameraOpen(true);
        setCameraError(null);
        setIsStreamReady(false);

        const handleError = (err: any) => {
            console.error("Camera access error:", err.name, err.message);
            let message = "Không thể truy cập camera. ";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                message += "Bạn đã từ chối quyền truy cập camera. Vui lòng bật lại quyền trong cài đặt của trình duyệt.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                message += "Không tìm thấy thiết bị camera phù hợp trên thiết bị của bạn.";
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                message += "Không thể sử dụng camera. Có thể nó đang được sử dụng bởi một ứng dụng khác.";
            } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
                 message += "Camera của bạn không hỗ trợ các yêu cầu cần thiết (ví dụ: độ phân giải).";
            } else {
                message += "Vui lòng kiểm tra lại quyền truy cập và thử lại.";
            }
            setCameraError(message);
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.warn("Could not get environment camera, trying default.", err);
            try {
                const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = fallbackStream;
                if (videoRef.current) videoRef.current.srcObject = fallbackStream;
            } catch (fallbackErr) {
                handleError(fallbackErr);
            }
        }
    };

    const closeCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
        setCameraError(null);
        setIsStreamReady(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current && isStreamReady) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                if (blob) {
                    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                    setImageFile(file);
                    setImageOrientation(1); // Camera captures are always correctly oriented (value 1 means no rotation)
                    setImageRotation(0);
                    processImageFile(file);
                }
            }, 'image/jpeg');
            closeCamera();
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatusMessage(''); // Clear message on new submission attempt

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to midnight to compare dates only
        const selectedDate = new Date(date + 'T00:00:00'); // Ensure it's parsed as local midnight

        if (selectedDate > today) {
            setStatusMessage('Lỗi: Ngày cấp không được lớn hơn ngày hiện tại.');
            return;
        }

        if (selectedDate.getFullYear() < 2021) {
            setStatusMessage('Lỗi: Ngày cấp không được trước năm 2021.');
            return;
        }

        if (!name.trim() || !date || !credits.trim() || !imageFile) {
            setStatusMessage('Lỗi: Vui lòng điền đầy đủ thông tin và chọn hình ảnh chứng chỉ.');
            return;
        }
        if (parseFloat(credits) <= 0) {
            setStatusMessage('Lỗi: Số tiết phải là một số dương (lớn hơn 0).');
            return;
        }

        const newCertificate: NewCertificatePayload = {
            name: name.trim(), date,
            credits: parseFloat(credits),
            imageFile: imageFile,
            orientation: imageOrientation,
        };

        setConfirmation({
            message: 'Bạn có chắc chắn muốn thêm chứng chỉ này không?',
            onConfirm: async () => {
                setIsProcessing(true);
                setStatusMessage('Đang lưu chứng chỉ và tải ảnh lên...');
                try {
                    await onAddCertificate(newCertificate);
                    // Reset form after successful submission
                    handleCancel();
                } catch (error) {
                    // Error is handled by the caller, which shows an alert.
                    // We just need to make sure we stop the processing indicator.
                    setStatusMessage('Lỗi: không thể thêm chứng chỉ.');
                } finally {
                     setIsProcessing(false);
                }
            }
        });
    };
    
    return (
        <div>
            <h2>Thêm mới chứng chỉ</h2>
            <form onSubmit={handleSubmit} className="entry-form">
                <div className="form-group">
                    <label htmlFor="cert-image">Hình ảnh chứng chỉ</label>
                    <input type="file" id="cert-image" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} disabled={isProcessing} />
                     <div className="image-input-buttons">
                        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                            <span className="material-icons">upload_file</span> Tải ảnh lên
                        </button>
                        <button type="button" className="btn" onClick={openCamera} disabled={isProcessing}>
                            <span className="material-icons">photo_camera</span> Chụp ảnh
                        </button>
                    </div>
                    {imageFile && <p style={{marginTop: '8px'}}>Đã chọn: {imageFile.name}</p>}
                    {imagePreviewUrl && (
                        <div className="image-preview">
                            <img 
                                src={imagePreviewUrl} 
                                alt="Xem trước hình ảnh" 
                                style={{ transform: `rotate(${imageRotation}deg)` }}
                            />
                        </div>
                    )}
                    {statusMessage && <p className={`extraction-status ${statusMessage.startsWith('Lỗi') || statusMessage.startsWith('Tôi không thể') ? 'error' : ''}`}>{statusMessage}</p>}
                </div>
                 <div className="form-group">
                    <label htmlFor="cert-name">Tên chứng chỉ</label>
                    <input type="text" id="cert-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isProcessing}/>
                </div>
                <div className="form-group">
                    <label htmlFor="cert-date">Ngày cấp</label>
                    <input type="date" id="cert-date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={isProcessing} />
                </div>
                <div className="form-group">
                    <label htmlFor="cert-credits">Số tiết</label>
                    <input type="number" step="0.1" id="cert-credits" value={credits} onChange={(e) => setCredits(e.target.value)} required min="0.1" disabled={isProcessing} />
                </div>
                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={isProcessing}>
                        <span className="material-icons">cancel</span>
                        Hủy
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                        <span className="material-icons">{isProcessing ? 'hourglass_top' : 'add_circle'}</span>
                        {isProcessing ? 'Đang xử lý...' : 'Thêm chứng chỉ'}
                    </button>
                </div>
            </form>
            {isCameraOpen && (
                 <div className="modal-overlay" onClick={closeCamera}>
                    <div className="modal-content camera-modal" onClick={(e) => e.stopPropagation()}>
                        {cameraError ? (
                            <div className="camera-error-display">
                                <h4>Lỗi Camera</h4>
                                <p>{cameraError}</p>
                            </div>
                        ) : (
                            <>
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted
                                    onCanPlay={() => setIsStreamReady(true)}
                                ></video>
                                {!isStreamReady && <div className="camera-loading-indicator">Đang khởi động camera...</div>}
                            </>
                        )}
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={closeCamera}>{cameraError ? 'Đóng' : 'Hủy'}</button>
                            {!cameraError && 
                                <button className="btn btn-primary" onClick={capturePhoto} disabled={!isStreamReady}>
                                    {isStreamReady ? 'Chụp' : 'Đang tải...'}
                                </button>
                            }
                        </div>
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    </div>
                </div>
            )}
            {confirmation && (
                <ConfirmationModal 
                    message={confirmation.message}
                    onConfirm={() => {
                        if (confirmation) confirmation.onConfirm();
                        setConfirmation(null);
                    }}
                    onCancel={() => setConfirmation(null)}
                />
            )}
        </div>
    );
};

interface Message {
    sender: 'user' | 'ai' | 'error';
    text: string;
}

const AIAssistantTab = ({ certificates, users }: { certificates: Certificate[], users: User[] }) => {
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'ai', text: 'Xin chào! Tôi là trợ lý AI. Hãy hỏi tôi các câu hỏi phân tích về dữ liệu đào tạo.' }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const userMessage = userInput.trim();
        if (!userMessage || isLoading) return;

        const newMessages: Message[] = [...messages, { sender: 'user', text: userMessage }];
        setMessages(newMessages);
        setUserInput('');
        setIsLoading(true);

        try {
            // Securely call the backend which then calls the Gemini API
            const aiResponseText = await api.request('POST', 'askAI', {
                userMessage: userMessage,
                users: users,
                certificates: certificates
            });

            setMessages([...newMessages, { sender: 'ai', text: aiResponseText }]);
        } catch (error: any) {
            console.error("AI Assistant Error:", error);
            const errorMessage = error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
            setMessages([...newMessages, { sender: 'error', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    const suggestionPrompts = [
        "Ai có nhiều chứng chỉ nhất quý trước?",
        "Khoa nào có số tiết trung bình cao nhất?",
        "Thống kê số lượng chứng chỉ theo từng khoa trong năm nay.",
        "Những ai chưa có chứng chỉ nào trong tháng trước?",
    ];

    const handleSuggestionClick = (prompt: string) => {
        setUserInput(prompt);
    };

    return (
        <div>
            <h2>Trợ lý AI</h2>
            <div className="ai-assistant-page-container">
                <div className="ai-assistant-container">
                    <div className="chat-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-message ${msg.sender}-message`}>
                                <p>{msg.text}</p>
                            </div>
                        ))}
                        {messages.length === 1 && !isLoading && (
                            <div className="suggestion-prompts">
                                <h4>Gợi ý cho bạn:</h4>
                                {suggestionPrompts.map((prompt, i) => (
                                    <button key={i} onClick={() => handleSuggestionClick(prompt)}>
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        )}
                        {isLoading && (
                            <div className="chat-message ai-message">
                                <div className="loading-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="chat-input-form">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Hỏi AI về dữ liệu..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !userInput.trim()}>
                            <span className="material-icons">send</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};


const InspectionView = ({ users, certificates, user, onUpdateCertificate, onDeleteCertificate }: {
    users: User[];
    certificates: Certificate[];
    user: User;
    onUpdateCertificate: (cert: Certificate, newImageFile?: File, newImageOrientation?: number) => void;
    onDeleteCertificate: (id: number) => void;
}) => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const [expandedCertId, setExpandedCertId] = useState<number | null>(null);
    const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
    const [confirmation, setConfirmation] = useState<{message: string, onConfirm: () => void} | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    const allUserEmployees = useMemo(() => {
        return users
            .filter(u => u.role !== 'admin' && !u.isSuspended)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }, [users]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSuggestionsVisible(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (selectedUser && value !== selectedUser.name) {
            setSelectedUser(null);
            setExpandedCertId(null);
        }

        if (value.trim().length > 0) {
            const normalizedSearch = normalizeText(value);
            const filtered = allUserEmployees.filter(u => normalizeText(u.name).includes(normalizedSearch));
            setSuggestions(filtered);
            setIsSuggestionsVisible(true);
        } else {
            setSuggestions([]);
            setIsSuggestionsVisible(false);
        }
    };

    const handleSelectUser = (user: User) => {
        setSelectedUser(user);
        setSearchTerm(user.name);
        setIsSuggestionsVisible(false);
        setSuggestions([]);
        setExpandedCertId(null);
    };

    const selectedUserCerts = useMemo(() => {
        if (!selectedUser) return [];
        return certificates
            .filter(c => c.userId === selectedUser.id)
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }, [certificates, selectedUser]);

    const handleEdit = (e: React.MouseEvent, cert: Certificate) => {
        e.stopPropagation();
        setEditingCertificate(cert);
    };

    const handleDelete = (e: React.MouseEvent, certId: number, certName: string) => {
        e.stopPropagation();
        setConfirmation({
            message: `Bạn có chắc chắn muốn xóa chứng chỉ "${certName}" của ${selectedUser?.name} không?`,
            onConfirm: () => {
                onDeleteCertificate(certId);
                setConfirmation(null);
            }
        });
    };

    const handleSaveCertificate = (updatedCert: Certificate, newImageFile?: File, newImageOrientation?: number) => {
        onUpdateCertificate(updatedCert, newImageFile, newImageOrientation);
        setEditingCertificate(null);
    };
    
    return (
        <div className="inspection-view-container">
            <div className="inspection-search-container" ref={searchRef}>
                <label htmlFor="inspection-search">Tìm kiếm nhân viên</label>
                <div className="search-input-wrapper">
                    <input
                        id="inspection-search"
                        type="search"
                        placeholder="Gõ tên để tìm..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        onFocus={() => { if (searchTerm && suggestions.length > 0) setIsSuggestionsVisible(true); }}
                        className="admin-search-input"
                        autoComplete="off"
                    />
                     {isSuggestionsVisible && suggestions.length > 0 && (
                        <ul className="inspection-suggestions-list">
                            {suggestions.map(userSuggestion => (
                                <li key={userSuggestion.id} onMouseDown={() => handleSelectUser(userSuggestion)}>
                                    <span>{userSuggestion.name}</span>
                                    <small>{userSuggestion.department}</small>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="inspection-content-result">
                {!selectedUser && (
                    <div className="no-results">
                        <p>Gõ vào ô tìm kiếm và chọn một nhân viên để xem chứng chỉ.</p>
                    </div>
                )}
                {selectedUser && (
                    <>
                        <h4>Chứng chỉ của: {selectedUser.name}</h4>
                        {selectedUserCerts.length > 0 ? (
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Tên chứng chỉ</th>
                                        <th>Ngày cấp</th>
                                        <th>Số tiết</th>
                                        {user.role === 'admin' && <th>Hành động</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedUserCerts.map((cert, index) => (
                                        <React.Fragment key={cert.id}>
                                            <tr
                                                onClick={() => cert.image && setExpandedCertId(prev => prev === cert.id ? null : cert.id)}
                                                className={cert.image ? 'clickable-row' : ''}
                                                aria-expanded={expandedCertId === cert.id}
                                                aria-controls={`cert-image-${cert.id}`}
                                            >
                                                <td data-label="STT">{index + 1}</td>
                                                <td data-label="Tên chứng chỉ">{cert.name}</td>
                                                <td data-label="Ngày cấp">{formatDateForDisplay(cert.date)}</td>
                                                <td data-label="Số tiết">{cert.credits}</td>
                                                {user.role === 'admin' && (
                                                    <td data-label="Hành động">
                                                        <div className="certificate-actions" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                                                            <button className="btn-icon" title="Sửa" onClick={(e) => handleEdit(e, cert)}>
                                                                <span className="material-icons">edit</span>
                                                            </button>
                                                            <button className="btn-icon btn-delete" title="Xóa" onClick={(e) => handleDelete(e, cert.id, cert.name)}>
                                                                <span className="material-icons">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                            {expandedCertId === cert.id && (
                                                <tr className="expanded-image-row" id={`cert-image-${cert.id}`}>
                                                    <td colSpan={user.role === 'admin' ? 5 : 4}>
                                                        <div className="expanded-image">
                                                            <img
                                                                src={cert.image || 'https://via.placeholder.com/600x400.png?text=Kh%C3%B4ng+th%E1%BB%83+t%E1%BA%A3i+%E1%BA%A3nh'}
                                                                alt={cert.name}
                                                                style={{ transform: `rotate(${getRotationFromExif(cert.imageOrientation)}deg)` }}
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.onerror = null;
                                                                    target.src='https://via.placeholder.com/600x400.png?text=Kh%C3%B4ng+th%E1%BB%83+t%E1%BA%A3i+%E1%BA%A3nh';
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="no-results">
                                <p>Nhân viên này chưa có chứng chỉ nào.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
             {editingCertificate && (
                <EditCertificateModal
                    certificate={editingCertificate}
                    onSave={handleSaveCertificate}
                    onCancel={() => setEditingCertificate(null)}
                />
            )}
            {confirmation && (
                <ConfirmationModal
                    message={confirmation.message}
                    onConfirm={confirmation.onConfirm}
                    onCancel={() => setConfirmation(null)}
                />
            )}
        </div>
    );
};


const ReportingTab = ({ certificates, users, user, onUpdateCertificate, onDeleteCertificate, onUpdateCertificateOrientation, complianceStartYear, titles }: { 
    certificates: Certificate[], 
    users: User[],
    user: User,
    onUpdateCertificate: (cert: Certificate, newImageFile?: File, newImageOrientation?: number) => void,
    onDeleteCertificate: (id: number) => void,
    onUpdateCertificateOrientation: (certId: number, orientation: number) => void,
    complianceStartYear: number;
    titles: Title[];
}) => {
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstance = useRef<Chart | null>(null);
    const reportOutputRef = useRef<HTMLDivElement | null>(null);
    const [chartYear, setChartYear] = useState(new Date().getFullYear());
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [generatedReport, setGeneratedReport] = useState<ReportData | null>(null);
    const [reportYears, setReportYears] = useState<string[]>([new Date().getFullYear().toString()]);
    const [reportDepartments, setReportDepartments] = useState<string[]>([]);
    const [reportDepartmentYears, setReportDepartmentYears] = useState<string[]>([]);
    const [reportTitles, setReportTitles] = useState<string[]>([]);
    const [reportTitleYears, setReportTitleYears] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
    const [activeSubTab, setActiveSubTab] = useState('reporting');

    const allYears = useMemo(() => {
        const certYears = certificates.map(c => new Date(c.date).getFullYear().toString());
        return [...new Set(certYears)].sort((a, b) => Number(b) - Number(a)).map(y => ({ id: y, name: y }));
    }, [certificates]);

    const allUserEmployees = useMemo(() => users.filter(u => u.role !== 'admin' && u.role !== 'reporter' && !u.isSuspended), [users]);
    const allDepartments = useMemo(() => [...new Set(allUserEmployees.map(u => u.department).filter(Boolean))].sort().map(d => ({ id: d, name: d })), [allUserEmployees]);
    
     useEffect(() => {
        if (!chartRef.current || activeSubTab !== 'reporting') return;
        
        const context = chartRef.current.getContext('2d');
        if (!context) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const certsInYear = certificates.filter(c => new Date(c.date).getFullYear() === chartYear);
        const dataByMonth = Array(12).fill(0);
        certsInYear.forEach(cert => {
            dataByMonth[new Date(cert.date).getMonth()]++;
        });

        const dataByDepartment: { [key: string]: number } = {};
        if (chartType === 'pie' || chartType === 'doughnut') {
            certsInYear.forEach(cert => {
                const user = allUserEmployees.find(u => u.id === cert.userId);
                if (user && user.department) {
                    dataByDepartment[user.department] = (dataByDepartment[user.department] || 0) + 1;
                }
            });
        }
        
        const chartData = {
            bar: {
                labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
                datasets: [{ label: `Số chứng chỉ năm ${chartYear}`, data: dataByMonth, backgroundColor: 'rgba(10, 147, 150, 0.6)' }]
            },
            line: {
                labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
                datasets: [{ label: `Số chứng chỉ năm ${chartYear}`, data: dataByMonth, borderColor: 'rgba(10, 147, 150, 1)', fill: false }]
            },
            pie: {
                labels: Object.keys(dataByDepartment),
                datasets: [{ data: Object.values(dataByDepartment), backgroundColor: ['#005f73', '#0a9396', '#94d2bd', '#e9d8a6', '#ee9b00', '#ca6702', '#bb3e03'] }]
            }
        };

        chartInstance.current = new Chart(context, {
            type: chartType,
            data: chartData[chartType === 'doughnut' ? 'pie' : chartType],
            options: { responsive: true, maintainAspectRatio: false, scales: (chartType === 'bar' || chartType === 'line') ? { y: { beginAtZero: true, ticks: { precision: 0 } } } : {} }
        });

    }, [certificates, chartYear, chartType, allUserEmployees, activeSubTab]);
    
    const getTitleNameById = useCallback((id: string | undefined) => {
        return titles.find(t => String(t.id) === String(id))?.name || 'Chưa cập nhật';
    }, [titles]);

    // Stats Cards Data
    const totalUsers = allUserEmployees.length;
    const totalCertificates = certificates.length;
    // FIX: Ensure credits are treated as numbers in the reduce function to prevent type errors.
    const averageCredits = totalUsers > 0 ? (certificates.reduce((sum, c) => sum + Number(c.credits || 0), 0) / totalUsers).toFixed(1) : 0;
    
    const complianceCycleEndYear = complianceStartYear + 4;

    const complianceRate = useMemo(() => {
        if (totalUsers === 0) return '0%';
        const startYear = complianceStartYear;
        const endYear = startYear + 4;

        const certsInCycle = certificates.filter(c => {
            const certYear = new Date(c.date).getFullYear();
            return certYear >= startYear && certYear <= endYear;
        });

        const compliantUsers = allUserEmployees.filter(user => {
            const userCredits = certsInCycle.filter(c => c.userId === user.id).reduce((sum, c) => sum + Number(c.credits || 0), 0);
            return isUserCompliant(user, userCredits, titles).compliant;
        }).length;

        return `${((compliantUsers / totalUsers) * 100).toFixed(0)}%`;
    }, [complianceStartYear, certificates, allUserEmployees, totalUsers, titles]);


    const generateReport = (type: string, options: any) => {
        let reportData: ReportData = { title: '', headers: [], rows: [] };
        
        const startYear = complianceStartYear;
        const endYear = startYear + 4;

        switch (type) {
            case 'compliance': {
                reportData.title = `Báo cáo tuân thủ (Chu kỳ: ${startYear} - ${endYear})`;
                reportData.headers = ['Họ tên', 'Chức danh', 'Tổng số tiết', 'Yêu cầu', 'Trạng thái'];
                const certsInCycle = certificates.filter(c => {
                    const certYear = new Date(c.date).getFullYear();
                    return certYear >= startYear && certYear <= endYear;
                });
                reportData.rows = allUserEmployees.map((user) => {
                    const totalCredits = certsInCycle
                        .filter(c => c.userId === user.id)
                        .reduce((sum, c) => sum + Number(c.credits || 0), 0);
                    const { compliant, required } = isUserCompliant(user, totalCredits, titles);
                    const status = compliant ? 'Đạt' : 'Chưa đạt';
                    return [user.name, getTitleNameById(user.title), totalCredits, required, status];
                });
                break;
            }
            case 'year_summary': {
                if (!options.years || options.years.length === 0) {
                    alert('Vui lòng chọn ít nhất một năm.'); return;
                }
                reportData.title = `Báo cáo tổng hợp theo năm ${options.years.join(', ')}`;
                reportData.headers = ['Họ tên', 'Tổng số tiết'];
                const certsInYears = certificates.filter(c => options.years.includes(new Date(c.date).getFullYear().toString()));
                const creditsByUser = allUserEmployees.map(u => ({ id: u.id, name: u.name, totalCredits: 0 }));
                certsInYears.forEach(cert => {
                    const user = creditsByUser.find(u => u.id === cert.userId);
                    // FIX: Ensure credits are treated as a number during addition to prevent type errors.
                    if (user) user.totalCredits += Number(cert.credits || 0);
                });
                reportData.rows = creditsByUser.map((user) => [user.name, user.totalCredits]);
                break;
            }
            case 'year_detail': {
                if (!options.years || options.years.length === 0) {
                    alert('Vui lòng chọn ít nhất một năm.'); return;
                }
                reportData.title = `Báo cáo chi tiết theo năm ${options.years.join(', ')}`;
                reportData.headers = ['Họ tên', 'Tên chứng chỉ', 'Số tiết', 'Tổng tiết'];
                const certsInYears = certificates.filter(c => options.years.includes(new Date(c.date).getFullYear().toString()));

                const detailedRows: DetailedRowUser[] = [];
                const sortedUsers = [...allUserEmployees].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

                sortedUsers.forEach(user => {
                    const userCerts = certsInYears
                        .filter(c => c.userId === user.id)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    if (userCerts.length > 0) {
                        detailedRows.push({
                            name: user.name,
                            // FIX: Ensure credits are treated as numbers in the reduce function to prevent type errors.
                            totalCredits: userCerts.reduce((sum, c) => sum + Number(c.credits || 0), 0),
                            certificates: userCerts.map(cert => ({ name: cert.name, credits: cert.credits }))
                        });
                    }
                });
                reportData.detailedRows = detailedRows;
                reportData.rows = undefined;
                break;
            }
            case 'department': {
                 if (!options.departments || options.departments.length === 0) {
                    alert('Vui lòng chọn ít nhất một Khoa/Phòng.'); return;
                }
                const yearFilterActive = options.years && options.years.length > 0;
                let yearTitle = yearFilterActive ? ` (Năm: ${options.years.join(', ')})` : ' (Tất cả các năm)';
                reportData.title = `Báo cáo theo Khoa/Phòng: ${options.departments.map((d:string) => allDepartments.find(ad => ad.id === d)?.name).join(', ')}${yearTitle}`;
                reportData.headers = ['Họ tên', 'Tổng số tiết'];

                const relevantCerts = yearFilterActive
                    ? certificates.filter(c => options.years.includes(new Date(c.date).getFullYear().toString()))
                    : certificates;
                
                reportData.groups = options.departments.sort().map((dept: string) => {
                    const usersInDept = allUserEmployees.filter(u => u.department === dept);
                    const deptRows = usersInDept.map((user) => {
                        const totalCredits = relevantCerts
                            .filter(c => c.userId === user.id)
                            .reduce((sum, c) => sum + Number(c.credits || 0), 0);
                        return [user.name, totalCredits];
                    });
                    return { groupTitle: dept, rows: deptRows };
                });
                reportData.rows = undefined;
                break;
            }
            case 'title_detail': {
                 if (!options.titles || options.titles.length === 0) {
                    alert('Vui lòng chọn ít nhất một chức danh.'); return;
                }
                const yearFilterActive = options.years && options.years.length > 0;
                let yearTitle = yearFilterActive ? ` (Năm: ${options.years.join(', ')})` : ' (Tất cả các năm)';
                const titleNames = options.titles.map((tid: string) => getTitleNameById(tid)).join(', ');
                reportData.title = `Báo cáo chi tiết theo Chức danh: ${titleNames}${yearTitle}`;
                reportData.headers = ['Họ tên', 'Tên chứng chỉ', 'Số tiết', 'Tổng tiết'];

                const relevantUsers = allUserEmployees.filter(u => options.titles.includes(String(u.title)));
                const relevantCerts = yearFilterActive
                    ? certificates.filter(c => options.years.includes(new Date(c.date).getFullYear().toString()))
                    : certificates;

                const detailedRows: DetailedRowUser[] = [];
                const sortedUsers = [...relevantUsers].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

                sortedUsers.forEach(user => {
                    const userCerts = relevantCerts
                        .filter(c => c.userId === user.id)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    if (userCerts.length > 0) {
                        detailedRows.push({
                            name: user.name,
                            totalCredits: userCerts.reduce((sum, c) => sum + Number(c.credits || 0), 0),
                            certificates: userCerts.map(cert => ({ name: cert.name, credits: cert.credits }))
                        });
                    }
                });
                reportData.detailedRows = detailedRows;
                reportData.rows = undefined;
                break;
            }
            case 'date_range': {
                 reportData.title = `Báo cáo từ ${options.from} đến ${options.to}`;
                 reportData.headers = ['Họ tên', 'Tổng số tiết'];
                 const fromDate = new Date(options.from);
                 const toDate = new Date(options.to);
                 const certsInRange = certificates.filter(c => {
                    const certDate = new Date(c.date);
                    return certDate >= fromDate && certDate <= toDate;
                 });
                 const creditsByUser = allUserEmployees.map(u => ({ id: u.id, name: u.name, totalCredits: 0 }));
                 certsInRange.forEach(cert => {
                    const user = creditsByUser.find(u => u.id === cert.userId);
                    // FIX: Ensure credits are treated as a number during addition to prevent type errors.
                    if(user) user.totalCredits += Number(cert.credits || 0);
                 });
                 reportData.rows = creditsByUser.map((user) => [user.name, user.totalCredits]);
                 break;
            }
        }
        setSortConfig({ key: null, direction: 'ascending' });
        setGeneratedReport(reportData);
        setTimeout(() => {
            reportOutputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedReportData = useMemo(() => {
        if (!generatedReport || !sortConfig.key) {
            return generatedReport;
        }

        const sortKey = sortConfig.key;
        const direction = sortConfig.direction === 'ascending' ? 1 : -1;

        if (generatedReport.detailedRows) {
            const sortedRows = [...generatedReport.detailedRows];

            if (sortKey === 'Họ tên' || sortKey === 'Tổng tiết') {
                const prop = sortKey === 'Họ tên' ? 'name' : 'totalCredits';
                sortedRows.sort((a, b) => {
                    const valA = a[prop as keyof typeof a];
                    const valB = b[prop as keyof typeof b];
                    if (typeof valA === 'string' && typeof valB === 'string') {
                        return valA.localeCompare(valB, 'vi') * direction;
                    }
                    if (valA < valB) return -1 * direction;
                    if (valA > valB) return 1 * direction;
                    return 0;
                });
            } else if (sortKey === 'Tên chứng chỉ' || sortKey === 'Số tiết') {
                sortedRows.forEach(userRow => {
                    const prop = sortKey === 'Tên chứng chỉ' ? 'name' : 'credits';
                    userRow.certificates.sort((a, b) => {
                        const valA = a[prop as keyof typeof a];
                        const valB = b[prop as keyof typeof b];
                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return valA.localeCompare(valB, 'vi') * direction;
                        }
                        if (valA < valB) return -1 * direction;
                        if (valA > valB) return 1 * direction;
                        return 0;
                    });
                });
            }
            return { ...generatedReport, detailedRows: sortedRows };
        }

        const sortKeyIndex = generatedReport.headers.indexOf(sortConfig.key);
        if (sortKeyIndex === -1) {
            return generatedReport;
        }
        
        const sortFunction = (a: (string|number)[], b: (string|number)[]) => {
            const aValue = a[sortKeyIndex];
            const bValue = b[sortKeyIndex];
            
            const numericHeaders = ['Tổng số tiết', 'Số tiết', 'Yêu cầu'];
            if (numericHeaders.includes(generatedReport.headers[sortKeyIndex])) {
                 const numA = parseFloat(String(aValue).replace(/,/g, ''));
                 const numB = parseFloat(String(bValue).replace(/,/g, ''));
                 if (!isNaN(numA) && !isNaN(numB)) {
                    return (numA - numB) * direction;
                 }
            }
            
            return String(aValue).localeCompare(String(bValue), 'vi', { sensitivity: 'base' }) * direction;
        };
        
        if (generatedReport.rows) {
            const sortedRows = [...generatedReport.rows].sort(sortFunction);
            return { ...generatedReport, rows: sortedRows };
        }

        if (generatedReport.groups) {
            const sortedGroups = generatedReport.groups.map(group => ({
                ...group,
                rows: [...group.rows].sort(sortFunction)
            }));
            return { ...generatedReport, groups: sortedGroups };
        }

        return generatedReport;
    }, [generatedReport, sortConfig]);
    
    const ReportRenderer = () => {
        if (!sortedReportData) return <p>Chọn một loại báo cáo và tạo để xem kết quả.</p>;
        
        const handleExport = (format: 'csv' | 'excel') => {
            const exportHeaders = ['STT', ...sortedReportData.headers];

            const getFlatRowsWithStt = () => {
                const allRows: (string | number)[][] = [];
                let sttCounter = 1;
                if (sortedReportData.detailedRows) {
                    sortedReportData.detailedRows.forEach((userRow) => {
                        if (userRow.certificates.length === 0) {
                            allRows.push([sttCounter++, userRow.name, '', '', userRow.totalCredits]);
                        } else {
                            userRow.certificates.forEach((cert, certIndex) => {
                                if (certIndex === 0) {
                                    allRows.push([sttCounter++, userRow.name, cert.name, cert.credits, userRow.totalCredits]);
                                } else {
                                    allRows.push(['', '', cert.name, cert.credits, '']);
                                }
                            });
                        }
                    });
                } else if (sortedReportData.groups) {
                    sortedReportData.groups.forEach(group => {
                        allRows.push([group.groupTitle]);
                        const groupRows = group.rows.map((row, index) => [index + 1, ...row]);
                        allRows.push(...groupRows);
                    });
                } else if (sortedReportData.rows) {
                    sortedReportData.rows.forEach((row, index) => {
                         allRows.push([index + 1, ...row]);
                    });
                }
                return allRows;
            }
            
            if (format === 'csv') {
                let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Excel
                csvContent += exportHeaders.join(",") + "\r\n";
                const rowsToExport = getFlatRowsWithStt();
                rowsToExport.forEach(rowArray => {
                    let row = rowArray.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",");
                    csvContent += row + "\r\n";
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "bao_cao.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (format === 'excel') {
                const wb = XLSX.utils.book_new();
                let ws_data: (string | number)[][] = [exportHeaders];
                ws_data.push(...getFlatRowsWithStt());
                const ws = XLSX.utils.aoa_to_sheet(ws_data);

                // --- START: Styling ---
                const borderStyle = {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } }
                };

                const headerStyle = {
                    font: { bold: true },
                    border: borderStyle,
                    fill: { fgColor: { rgb: "E0E0E0" } }
                };

                const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
                
                // Loop through all cells in the worksheet range to apply styles
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                        let cell = ws[cell_address];
                        
                        // Create cell object if it doesn't exist to ensure styles are applied
                        if (!cell) {
                            ws[cell_address] = { t: 's', v: '' };
                            cell = ws[cell_address];
                        }

                        if (R === 0) { // Header row
                            cell.s = headerStyle;
                        } else {
                            // Apply border to all other cells
                            if (!cell.s) cell.s = {};
                            cell.s.border = borderStyle;
                        }
                    }
                }
                
                // Auto-fit columns
                const colWidths = ws_data[0].map((_, i) => {
                    const maxLength = ws_data.reduce((max, row) => Math.max(max, String(row[i] || '').length), 0);
                    return { wch: Math.max(10, maxLength + 2) }; // Min width 10, plus padding
                });
                ws['!cols'] = colWidths;
                // --- END: Styling ---

                XLSX.utils.book_append_sheet(wb, ws, "BaoCao");
                XLSX.writeFile(wb, "bao_cao.xlsx");
            }
        };
        
        const renderTbody = () => {
            if (sortedReportData.detailedRows) {
                return sortedReportData.detailedRows.map((userRow, userIndex) => (
                    <React.Fragment key={userIndex}>
                        {userRow.certificates.map((cert, certIndex) => (
                            <tr key={`${userIndex}-${certIndex}`}>
                                {certIndex === 0 && (
                                    <>
                                        <td rowSpan={userRow.certificates.length || 1} data-label="STT">{userIndex + 1}</td>
                                        <td rowSpan={userRow.certificates.length || 1} data-label={sortedReportData.headers[0]}>{userRow.name}</td>
                                    </>
                                )}
                                <td data-label={sortedReportData.headers[1]}>{cert.name}</td>
                                <td data-label={sortedReportData.headers[2]}>{cert.credits}</td>
                                {certIndex === 0 && (
                                    <td rowSpan={userRow.certificates.length || 1} data-label={sortedReportData.headers[3]}>{userRow.totalCredits}</td>
                                )}
                            </tr>
                        ))}
                         {userRow.certificates.length === 0 && (
                             <tr>
                                 <td data-label="STT">{userIndex + 1}</td>
                                 <td data-label={sortedReportData.headers[0]}>{userRow.name}</td>
                                 <td data-label={sortedReportData.headers[1]}></td>
                                 <td data-label={sortedReportData.headers[2]}></td>
                                 <td data-label={sortedReportData.headers[3]}>{userRow.totalCredits}</td>
                             </tr>
                         )}
                    </React.Fragment>
                ));
            }
            if (sortedReportData.groups) {
                return (
                    <>
                        {sortedReportData.groups.map(group => (
                            <React.Fragment key={group.groupTitle}>
                                <tr className="department-header-row">
                                    <th colSpan={sortedReportData.headers.length + 1}>{group.groupTitle}</th>
                                </tr>
                                {group.rows.map((row, r_idx) => (
                                    <tr key={`${group.groupTitle}-${r_idx}`}>
                                        <td data-label="STT">{r_idx + 1}</td>
                                        {row.map((cell, c_idx) => <td key={c_idx} data-label={sortedReportData.headers[c_idx]}>{cell}</td>)}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </>
                );
            }
            if (sortedReportData.rows) {
                 return sortedReportData.rows.map((row, r_idx) => (
                     <tr key={r_idx}>
                         <td data-label="STT">{r_idx + 1}</td>
                         {row.map((cell, c_idx) => <td key={c_idx} data-label={sortedReportData.headers[c_idx]}>{cell}</td>)}
                     </tr>
                 ));
            }
            return null;
        };

        const sortableColumns = ['Họ tên', 'Chức danh', 'Tổng số tiết', 'Yêu cầu', 'Trạng thái', 'Tên chứng chỉ', 'Số tiết'];
        const allHeaders = ['STT', ...sortedReportData.headers];

        return (<div className="report-output">
            <div className="report-output-header">
                <h4>{sortedReportData.title}</h4>
                <div className="report-actions">
                     <button className="btn btn-secondary" onClick={() => window.print()}>
                        <span className="material-icons">print</span>
                        In báo cáo
                    </button>
                    <div className="export-dropdown">
                        <button className="btn btn-export">
                            <span className="material-icons">download</span>
                            Xuất báo cáo
                        </button>
                        <div className="export-dropdown-content">
                            <button onClick={() => handleExport('excel')}>Xuất Excel (.xlsx)</button>
                            <button onClick={() => handleExport('csv')}>Xuất CSV (.csv)</button>
                        </div>
                    </div>
                </div>
            </div>
            <table className="report-table">
                <thead>
                    <tr>
                        {allHeaders.map(h => {
                            const isSortable = sortableColumns.includes(h);
                            const sortClass = isSortable ? 'sortable' : '';
                            const sortIndicator = isSortable && sortConfig.key === h
                                ? <span className="sort-indicator">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                                : null;
                            
                            return (
                                <th key={h} className={sortClass} onClick={() => isSortable && requestSort(h)}>
                                    {h}
                                    {sortIndicator}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {renderTbody()}
                </tbody>
            </table>
        </div>);
    };

    return (
        <div>
            <h2>Báo cáo & Thống kê</h2>
             <div className="admin-sub-tabs">
                <button 
                    className={activeSubTab === 'reporting' ? 'active' : ''} 
                    onClick={() => setActiveSubTab('reporting')}
                >
                    Báo cáo & Thống kê
                </button>
                <button 
                    className={activeSubTab === 'inspection' ? 'active' : ''} 
                    onClick={() => setActiveSubTab('inspection')}
                >
                    Kiểm tra
                </button>
            </div>

            {activeSubTab === 'reporting' && (
                <div className="reporting-dashboard">
                    <div className="reporting-stats">
                        <div className="colorful-stat-card card-green">
                            <span className="material-icons stat-icon">groups</span>
                            <div className="stat-content">
                                <h4>Tổng số người dùng</h4>
                                <p>{totalUsers}</p>
                            </div>
                        </div>
                        <div className="colorful-stat-card card-yellow">
                             <span className="material-icons stat-icon">workspace_premium</span>
                            <div className="stat-content">
                                <h4>Tổng số chứng chỉ</h4>
                                <p>{totalCertificates}</p>
                            </div>
                        </div>
                        <div className="colorful-stat-card card-blue">
                            <span className="material-icons stat-icon">functions</span>
                            <div className="stat-content">
                                <h4>Số tiết trung bình</h4>
                                <p>{averageCredits}</p>
                            </div>
                        </div>
                        <div className="colorful-stat-card card-purple">
                            <span className="material-icons stat-icon">check_circle</span>
                             <div className="stat-content">
                                <h4>Tỷ lệ tuân thủ ({complianceCycleEndYear})</h4>
                                <p>{complianceRate}</p>
                            </div>
                        </div>
                    </div>

                    <aside className="reporting-controls-panel">
                        <h3>Tạo báo cáo</h3>
                        <div className="report-form">
                            <label>Báo cáo tuân thủ theo chu kỳ</label>
                            <button onClick={() => generateReport('compliance', {})}>Tạo</button>
                        </div>
                         <div className="report-form">
                            <label>Báo cáo tổng hợp/chi tiết theo năm</label>
                            <MultiSelector allItems={allYears} selectedItems={reportYears} onSelectionChange={setReportYears} placeholder="Năm"/>
                            <button onClick={() => generateReport('year_summary', {years: reportYears})}>Tạo tổng hợp</button>
                            <button onClick={() => generateReport('year_detail', {years: reportYears})}>Tạo chi tiết</button>
                        </div>
                        <div className="report-form">
                            <label>Báo cáo theo Khoa/Phòng</label>
                             <MultiSelector allItems={allDepartments} selectedItems={reportDepartments} onSelectionChange={setReportDepartments} placeholder="Khoa/Phòng"/>
                            <MultiSelector allItems={allYears} selectedItems={reportDepartmentYears} onSelectionChange={setReportDepartmentYears} placeholder="Năm (tùy chọn)"/>
                            <button onClick={() => generateReport('department', {departments: reportDepartments, years: reportDepartmentYears})}>Tạo</button>
                        </div>
                        <div className="report-form">
                            <label>Báo cáo chi tiết theo Chức danh</label>
                             <MultiSelector allItems={titles} selectedItems={reportTitles} onSelectionChange={setReportTitles} placeholder="Chức danh"/>
                            <MultiSelector allItems={allYears} selectedItems={reportTitleYears} onSelectionChange={setReportTitleYears} placeholder="Năm (tùy chọn)"/>
                            <button onClick={() => generateReport('title_detail', {titles: reportTitles, years: reportTitleYears})}>Tạo</button>
                        </div>
                        <div className="report-form">
                            <label>Báo cáo theo khoảng ngày</label>
                            <input type="date" id="report-from-date" />
                            <input type="date" id="report-to-date" />
                            <button onClick={() => generateReport('date_range', {from: (document.getElementById('report-from-date') as HTMLInputElement).value, to: (document.getElementById('report-to-date') as HTMLInputElement).value})}>Tạo</button>
                        </div>
                    </aside>

                    <main className="reporting-main-content">
                        <div className="chart-controls">
                            <h3>Thống kê trực quan</h3>
                            <div>
                                <select value={chartType} onChange={e => setChartType(e.target.value as ChartType)}>
                                    <option value="bar">Biểu đồ cột</option>
                                    <option value="line">Biểu đồ đường</option>
                                    <option value="pie">Biểu đồ tròn</option>
                                </select>
                                <select value={chartYear} onChange={e => setChartYear(parseInt(e.target.value))}>
                                    {allYears.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="chart-container"><canvas ref={chartRef}></canvas></div>
                        <div className="report-output-container" ref={reportOutputRef}>
                            <h3>Kết quả báo cáo</h3>
                            <ReportRenderer />
                        </div>
                    </main>
                </div>
            )}
            {activeSubTab === 'inspection' && 
                <InspectionView 
                    users={users}
                    certificates={certificates}
                    user={user}
                    onUpdateCertificate={onUpdateCertificate}
                    onDeleteCertificate={onDeleteCertificate}
                />
            }
        </div>
    );
};

const UserModal = ({ user, onSave, onCancel, allDepartments, titles, isSelfEdit = false }: { user: User | null, onSave: (data: NewUser, id?: number) => void, onCancel: () => void, allDepartments: string[], titles: Title[], isSelfEdit?: boolean }) => {
    const [formData, setFormData] = useState({
        username: '', name: '', department: '', role: 'user' as 'user' | 'admin' | 'reporter' | 'reporter_user', password: '',
        dateOfBirth: '', position: '', title: '', practiceCertificateNumber: '', practiceCertificateIssueDate: '',
        isSuspended: false
    });

    const isEditMode = user !== null;

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username,
                name: user.name,
                department: user.department,
                role: user.role,
                password: '',
                dateOfBirth: user.dateOfBirth || '',
                position: user.position || '',
                title: user.title || '',
                practiceCertificateNumber: user.practiceCertificateNumber || '',
                practiceCertificateIssueDate: user.practiceCertificateIssueDate || '',
                isSuspended: user.isSuspended || false,
            });
        } else {
            setFormData({ username: '', name: '', department: '', role: 'user', password: '', dateOfBirth: '', position: '', title: '', practiceCertificateNumber: '', practiceCertificateIssueDate: '', isSuspended: false });
        }
    }, [user]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'isSuspended') {
             setFormData(prev => ({ ...prev, [name]: value === 'true' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value as any }));
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { password, ...rest } = formData;
        const dataToSend: NewUser = rest;
        if(password) {
            dataToSend.password = password;
        }

        if(!dataToSend.username || !dataToSend.name || !dataToSend.department) {
            alert('Vui lòng điền đầy đủ các trường bắt buộc.');
            return;
        }

        onSave(dataToSend, user?.id);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{isSelfEdit ? 'Cập nhật thông tin cá nhân' : isEditMode ? 'Sửa thông tin người dùng' : 'Thêm người dùng mới'}</h2>
                <form onSubmit={handleSubmit} className="modal-form">
                    {!isSelfEdit && (
                        <>
                            <div className="form-group">
                                <label>Tên đăng nhập</label>
                                <input type="text" name="username" value={formData.username} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Mật khẩu</label>
                                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder={isEditMode ? 'Để trống nếu không đổi' : 'Bắt buộc'} required={!isEditMode}/>
                            </div>
                        </>
                    )}
                     <div className="form-group">
                        <label>Họ tên</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required disabled={isSelfEdit} />
                    </div>
                     <div className="form-group">
                        <label>Ngày sinh</label>
                        <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} />
                    </div>
                     <div className="form-group">
                        <label>Khoa/Phòng</label>
                        <input list="departments-list" type="text" name="department" value={formData.department} onChange={handleChange} required disabled={isSelfEdit} />
                        <datalist id="departments-list">
                            {allDepartments.map(dept => <option key={dept} value={dept} />)}
                        </datalist>
                    </div>
                     <div className="form-group">
                        <label>Chức vụ</label>
                        <input type="text" name="position" value={formData.position} onChange={handleChange} />
                    </div>
                     <div className="form-group">
                        <label>Chức danh</label>
                        <select name="title" value={formData.title} onChange={handleChange}>
                            <option value="">-- Chọn chức danh --</option>
                            {titles.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label>Số CCHN</label>
                        <input type="text" name="practiceCertificateNumber" value={formData.practiceCertificateNumber} onChange={handleChange} />
                    </div>
                     <div className="form-group">
                        <label>Ngày cấp CCHN</label>
                        <input type="date" name="practiceCertificateIssueDate" value={formData.practiceCertificateIssueDate} onChange={handleChange} />
                    </div>
                    {!isSelfEdit && (
                        <>
                            <div className="form-group">
                                <label>Vai trò</label>
                                <select name="role" value={formData.role} onChange={handleChange}>
                                    <option value="user">Nhân viên</option>
                                    <option value="reporter">Báo cáo viên</option>
                                    <option value="reporter_user">Nhân viên + Báo cáo</option>
                                    <option value="admin">Quản trị</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Trạng thái</label>
                                <select name="isSuspended" value={String(formData.isSuspended)} onChange={handleChange}>
                                    <option value="false">Hoạt động</option>
                                    <option value="true">Tạm ngừng</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
                        <button type="submit" className="btn btn-primary">Lưu</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminTab = ({ 
    users, 
    onAddUser, 
    onUpdateUser, 
    onDeleteUser, 
    googleSheetUrl, 
    googleFolderUrl,
    complianceStartYear,
    onUpdateComplianceYear,
    titles,
}: { 
    users: User[], 
    onAddUser: (user: NewUser) => Promise<void>, 
    onUpdateUser: (user: User) => Promise<void>, 
    onDeleteUser: (id: number) => Promise<void>,
    googleSheetUrl: string,
    googleFolderUrl: string,
    complianceStartYear: number,
    onUpdateComplianceYear: (year: number) => Promise<void>,
    titles: Title[],
}) => {
    const [activeAdminTab, setActiveAdminTab] = useState('users');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [confirmation, setConfirmation] = useState<{message: string, onConfirm: () => void} | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [yearInput, setYearInput] = useState(String(complianceStartYear));

    useEffect(() => {
        setYearInput(String(complianceStartYear));
    }, [complianceStartYear]);

    const handleSaveComplianceYear = async () => {
        const year = parseInt(yearInput, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
            alert('Vui lòng nhập một năm hợp lệ (ví dụ: 2021).');
            return;
        }
        if (year === complianceStartYear) {
            alert('Năm không có thay đổi.');
            return;
        }
        try {
            await onUpdateComplianceYear(year);
        } catch (e) {
            // Error is handled by the caller, just revert the input
            setYearInput(String(complianceStartYear));
        }
    };


    const filteredUsers = useMemo(() => {
        return users.filter(user => 
            user.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const allDepartments = useMemo(() => [...new Set(users.map(u => u.department).filter(Boolean))].sort(), [users]);

    const handleOpenAddUser = () => {
        setEditingUser(null);
        setIsUserModalOpen(true);
    };
    
    const handleOpenEditUser = (user: User) => {
        setEditingUser(user);
        setIsUserModalOpen(true);
    };
    
    const handleDeleteUser = (userId: number, userName: string) => {
        setConfirmation({
            message: `Bạn có chắc chắn muốn xóa người dùng "${userName}" không? Thao tác này cũng sẽ xóa toàn bộ chứng chỉ của họ.`,
            onConfirm: () => onDeleteUser(userId)
        });
    };
    
    const handleSaveUser = (data: NewUser, id?: number) => {
        if (id !== undefined && editingUser) {
            onUpdateUser({ ...editingUser, ...data, id });
        } else {
            onAddUser(data);
        }
        setIsUserModalOpen(false);
    };
    
    const handleConfirmAction = () => {
        if (confirmation) {
            confirmation.onConfirm();
            setConfirmation(null);
        }
    };

    const getRoleName = (role: User['role']) => {
        switch (role) {
            case 'admin': return 'Quản trị';
            case 'reporter': return 'Báo cáo viên';
            case 'reporter_user': return 'Nhân viên + Báo cáo';
            case 'user':
            default: return 'Nhân viên';
        }
    };

    return (
      <div>
        <h2>Quản trị hệ thống</h2>
        <div className="admin-sub-tabs">
            <button 
                className={activeAdminTab === 'users' ? 'active' : ''} 
                onClick={() => setActiveAdminTab('users')}
            >
                Quản lý người dùng
            </button>
            <button 
                className={activeAdminTab === 'api_status' ? 'active' : ''} 
                onClick={() => setActiveAdminTab('api_status')}
            >
                Tình trạng API
            </button>
            <button 
                className={activeAdminTab === 'settings' ? 'active' : ''} 
                onClick={() => setActiveAdminTab('settings')}
            >
                Cài đặt
            </button>
        </div>
        
        {activeAdminTab === 'users' && (
          <div className="admin-section">
            <div className="admin-header">
              <h3>Quản lý người dùng</h3>
              <input 
                  type="search" 
                  className="admin-search-input"
                  placeholder="Tìm kiếm theo họ tên..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Khoa/Phòng</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>{user.department}</td>
                    <td>{getRoleName(user.role)}</td>
                    <td>{user.isSuspended ? 'Tạm ngừng' : 'Hoạt động'}</td>
                    <td className="actions">
                      <button title="Sửa" onClick={() => handleOpenEditUser(user)}><span className="material-icons">edit</span></button>
                      <button title="Xóa" onClick={() => handleDeleteUser(user.id, user.name)}><span className="material-icons">delete</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-primary" style={{marginTop: '16px', width: 'auto'}} onClick={handleOpenAddUser}>
                <span className="material-icons">add</span>Thêm người dùng
            </button>
          </div>
        )}

        {activeAdminTab === 'api_status' && <ApiStatusTab />}

        {activeAdminTab === 'settings' && (
            <>
                <div className="admin-section">
                    <h3>Cài đặt chu kỳ tuân thủ</h3>
                    <p>Đặt năm bắt đầu cho chu kỳ tuân thủ 5 năm. Ví dụ, nhập 2021 sẽ áp dụng cho chu kỳ 2021-2025.</p>
                    <div className="compliance-setting-form">
                        <label htmlFor="complianceYearInput">Năm bắt đầu chu kỳ</label>
                        <input
                            type="number"
                            id="complianceYearInput"
                            value={yearInput}
                            onChange={(e) => setYearInput(e.target.value)}
                            placeholder="YYYY"
                        />
                        <button className="btn btn-primary" onClick={handleSaveComplianceYear}>Lưu thay đổi</button>
                    </div>
                </div>
                 <div className="admin-section">
                    <h3>Liên kết hệ thống</h3>
                    <p>Truy cập nhanh vào các tài nguyên lưu trữ dữ liệu của hệ thống.</p>
                    <div className="link-buttons">
                        <a href={googleSheetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-link">
                            <span className="material-icons">table_chart</span>
                            Mở Google Sheet
                        </a>
                        <a href={googleFolderUrl} target="_blank" rel="noopener noreferrer" className="btn btn-link">
                            <span className="material-icons">folder</span>
                            Mở Google Drive Folder
                        </a>
                    </div>
                </div>
            </>
        )}
        
        {isUserModalOpen && (
            <UserModal 
                user={editingUser}
                onSave={handleSaveUser}
                onCancel={() => setIsUserModalOpen(false)}
                allDepartments={allDepartments}
                titles={titles}
            />
        )}
        {confirmation && (
            <ConfirmationModal 
                message={confirmation.message}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmation(null)}
            />
        )}
      </div>
    );
};

const ApiStatusTab = () => {
    const [sheetsStatus, setSheetsStatus] = useState({ status: 'idle', message: 'Chưa kiểm tra' });
    const [primaryApiStatus, setPrimaryApiStatus] = useState({ status: 'idle', message: 'Chưa kiểm tra' });
    const [secondaryApiStatus, setSecondaryApiStatus] = useState({ status: 'idle', message: 'Chưa kiểm tra' });
    const [assistantApiStatus, setAssistantApiStatus] = useState({ status: 'idle', message: 'Chưa kiểm tra' });

    const checkSheets = async () => {
        setSheetsStatus({ status: 'loading', message: 'Đang kiểm tra...' });
        try {
            await api.request('GET', 'fetchInitialData');
            setSheetsStatus({ status: 'success', message: 'Kết nối tới Google Sheets thành công. Dữ liệu có thể được đọc.' });
        } catch (error: any) {
            setSheetsStatus({ status: 'error', message: `Lỗi kết nối Google Sheets: ${error.message}` });
        }
    };

    const checkPrimaryGoogleApi = async () => {
        setPrimaryApiStatus({ status: 'loading', message: 'Đang kiểm tra...' });
        try {
            const response = await api.request('POST', 'checkExtractionApiKey', { keyName: 'primary' });
            setPrimaryApiStatus({ status: 'success', message: response.message || 'Kết nối thành công.' });
        } catch (error: any) {
            setPrimaryApiStatus({ status: 'error', message: `Lỗi: ${error.message}` });
        }
    };

    const checkSecondaryGoogleApi = async () => {
        setSecondaryApiStatus({ status: 'loading', message: 'Đang kiểm tra...' });
        try {
            const response = await api.request('POST', 'checkExtractionApiKey', { keyName: 'secondary' });
            setSecondaryApiStatus({ status: 'success', message: response.message || 'Kết nối thành công.' });
        } catch (error: any) {
            setSecondaryApiStatus({ status: 'error', message: `Lỗi: ${error.message}` });
        }
    };

    const checkAssistantApi = async () => {
        setAssistantApiStatus({ status: 'loading', message: 'Đang kiểm tra...' });
        try {
            const response = await api.request('POST', 'checkAssistantApiKey', {});
            setAssistantApiStatus({ status: 'success', message: response.message || 'Kết nối thành công.' });
        } catch (error: any) {
            setAssistantApiStatus({ status: 'error', message: `Lỗi: ${error.message}` });
        }
    };

    return (
        <div>
            <div className="api-status-card">
                <h3>Google Sheets API</h3>
                <p>Kiểm tra khả năng đọc và ghi dữ liệu từ Google Sheets, là nơi lưu trữ chính của hệ thống.</p>
                <div className="status-message-container">
                    <div className={`status-message ${sheetsStatus.status}`}>
                        <strong>Trạng thái:</strong> {sheetsStatus.message}
                    </div>
                </div>
                <button className="btn" onClick={checkSheets} disabled={sheetsStatus.status === 'loading'}>
                    <span className="material-icons">sync</span>
                    {sheetsStatus.status === 'loading' ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
                </button>
            </div>
            <div className="api-status-card">
                <h3>Google AI API (Trích xuất - Chính)</h3>
                <p>Kiểm tra API Key chính của Google (`GOOGLE_API_KEY`), được sử dụng mặc định cho tính năng trích xuất thông tin từ hình ảnh.</p>
                 <div className="status-message-container">
                    <div className={`status-message ${primaryApiStatus.status}`}>
                       <strong>Trạng thái:</strong> {primaryApiStatus.message}
                    </div>
                </div>
                <button className="btn" onClick={checkPrimaryGoogleApi} disabled={primaryApiStatus.status === 'loading'}>
                    <span className="material-icons">sync</span>
                    {primaryApiStatus.status === 'loading' ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
                </button>
            </div>
            <div className="api-status-card">
                <h3>Google AI API (Trích xuất - Dự phòng)</h3>
                <p>Kiểm tra API Key dự phòng của Google (`API_KEY`). Key này sẽ được sử dụng khi key chính gặp lỗi về hạn ngạch, giúp duy trì hoạt động của tính năng trích xuất.</p>
                 <div className="status-message-container">
                    <div className={`status-message ${secondaryApiStatus.status}`}>
                       <strong>Trạng thái:</strong> {secondaryApiStatus.message}
                    </div>
                </div>
                <button className="btn" onClick={checkSecondaryGoogleApi} disabled={secondaryApiStatus.status === 'loading'}>
                    <span className="material-icons">sync</span>
                    {secondaryApiStatus.status === 'loading' ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
                </button>
            </div>
             <div className="api-status-card">
                <h3>DeepSeek AI API (Trợ lý AI)</h3>
                <p>Kiểm tra API Key của DeepSeek (`DEEPSEEK_API_KEY`), được sử dụng cho tính năng Trợ lý AI trong tab trò chuyện.</p>
                 <div className="status-message-container">
                    <div className={`status-message ${assistantApiStatus.status}`}>
                       <strong>Trạng thái:</strong> {assistantApiStatus.message}
                    </div>
                </div>
                <button className="btn" onClick={checkAssistantApi} disabled={assistantApiStatus.status === 'loading'}>
                    <span className="material-icons">sync</span>
                    {assistantApiStatus.status === 'loading' ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
                </button>
            </div>
        </div>
    );
};


const PersonalInfoTab = ({ user, certificates, onEdit, complianceStartYear, titles }: { user: User, certificates: Certificate[], onEdit: () => void, complianceStartYear: number, titles: Title[] }) => {
    
    const complianceData = useMemo(() => {
        const startYear = complianceStartYear;
        const endYear = startYear + 4;

        const relevantCerts = certificates.filter(cert => {
            const certYear = new Date(cert.date).getFullYear();
            return cert.userId === user.id && certYear >= startYear && certYear <= endYear;
        });

        const accumulatedCredits = relevantCerts.reduce((sum, cert) => sum + Number(cert.credits || 0), 0);
        const { required } = isUserCompliant(user, accumulatedCredits, titles);
        const remainingCredits = Math.max(0, required - accumulatedCredits);
        
        const formatNumber = (num: number) => Number.isInteger(num) ? num : num.toFixed(1);

        return {
            startYear,
            endYear,
            accumulatedCredits: formatNumber(accumulatedCredits),
            requiredCredits: required,
            remainingCredits: formatNumber(remainingCredits)
        };
    }, [user, certificates, complianceStartYear, titles]);

    const getTitleName = (id: string | undefined) => {
        if (!id) return 'Chưa cập nhật';
        return titles.find(t => String(t.id) === String(id))?.name || 'Không xác định';
    };


    return (
        <div>
            <div className="personal-info-title-container">
                 <h2>Trang cá nhân</h2>
                 <div className="compliance-marquee">
                    <p>
                        Chu kỳ {complianceData.startYear}-{complianceData.endYear}: Đã tích lũy {complianceData.accumulatedCredits}/{complianceData.requiredCredits} tiết.
                        Cần thêm {complianceData.remainingCredits} tiết.
                    </p>
                 </div>
            </div>
           
            <div className="profile-info-card">
                <div className="profile-info-header">
                    <h3>Thông tin cơ bản</h3>
                    <button className="btn" onClick={onEdit}>
                        <span className="material-icons">edit</span>
                        Cập nhật
                    </button>
                </div>
                <div className="profile-info-grid">
                     <div className="info-item info-item-full">
                        <label>Họ và tên</label>
                        <p className="info-item-name">{user.name || 'Chưa cập nhật'}</p>
                    </div>

                    <div className="info-item">
                        <label>Ngày sinh</label>
                        <p>{formatDateForDisplay(user.dateOfBirth)}</p>
                    </div>
                     <div className="info-item">
                        <label>Khoa/Phòng</label>
                        <p>{user.department || 'Chưa cập nhật'}</p>
                    </div>
                    
                     <div className="info-item">
                        <label>Chức vụ</label>
                        <p>{user.position || 'Chưa cập nhật'}</p>
                    </div>
                    <div className="info-item">
                        <label>Chức danh</label>
                        <p>{getTitleName(user.title)}</p>
                    </div>
                     <div className="info-item info-item-full info-separator">
                        <hr />
                    </div>

                    <div className="info-item">
                        <label>Số CCHN</label>
                        <p>{user.practiceCertificateNumber || 'Chưa cập nhật'}</p>
                    </div>
                     <div className="info-item">
                        <label>Ngày cấp CCHN</label>
                        <p>{formatDateForDisplay(user.practiceCertificateIssueDate)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface MainAppProps {
    user: User;
    users: User[];
    certificates: Certificate[];
    titles: Title[];
    activeTab: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    onAddCertificate: (cert: NewCertificatePayload) => Promise<void>;
    onUpdateCertificate: (cert: Certificate, newImageFile?: File, newImageOrientation?: number) => Promise<void>;
    onUpdateCertificateOrientation: (certId: number, orientation: number) => Promise<void>;
    onDeleteCertificate: (id: number) => Promise<void>;
    onAddUser: (user: NewUser) => Promise<void>;
    onUpdateUser: (user: User) => Promise<void>;
    onDeleteUser: (id: number) => Promise<void>;
    onChangePassword: (userId: number, oldPass: string, newPass: string) => Promise<void>;
    onUpdateComplianceYear: (year: number) => Promise<void>;
    googleSheetUrl: string;
    googleFolderUrl: string;
    complianceStartYear: number;
}

const MainApp = (props: MainAppProps) => {
  const { user, users, certificates, titles, activeTab, onNavigate, onLogout, onAddCertificate, onUpdateCertificate, onUpdateCertificateOrientation, onDeleteCertificate, onAddUser, onUpdateUser, onDeleteUser, onChangePassword, googleSheetUrl, googleFolderUrl, complianceStartYear, onUpdateComplianceYear } = props;
  const mainContentRef = useRef<HTMLElement>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);

  const allDepartments = useMemo(() => [...new Set(users.map(u => u.department).filter(Boolean))].sort(), [users]);
  
  const handleTabClick = (tabId: string) => {
    onNavigate(tabId);
    setTimeout(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTop = 0;
        }
    }, 0);
  };

  const handleAddCertificateAndSwitchTab = async (newCert: NewCertificatePayload) => {
    await onAddCertificate(newCert);
    handleTabClick('profile');
  };

  const handleSaveCurrentUser = (data: NewUser, id?: number) => {
      if (id !== undefined) {
          onUpdateUser({ ...user, ...data, id });
      }
      setIsEditUserModalOpen(false);
  };

  const userTabs = [
    { id: 'personal_info', label: 'Trang cá nhân', icon: 'person' },
    { id: 'profile', label: 'Chứng Chỉ', icon: 'workspace_premium' },
    { id: 'entry', label: 'Nhập liệu', icon: 'edit_document' }
  ];

  const reportingAndAITabs = [
    { id: 'reporting', label: 'Báo cáo', icon: 'bar_chart' },
    { id: 'ai_assistant', label: 'Trợ lý AI', icon: 'smart_toy' },
  ];
  
  const adminOnlyTabs = [
    { id: 'admin', label: 'Quản trị', icon: 'admin_panel_settings' },
  ];
  
  const tabs = useMemo(() => {
    switch (user.role) {
      case 'user':
        return userTabs;
      case 'reporter':
        return reportingAndAITabs;
      case 'reporter_user':
        return [...userTabs, ...reportingAndAITabs];
      case 'admin':
        return [...userTabs, ...reportingAndAITabs, ...adminOnlyTabs];
      default:
        return [];
    }
  }, [user.role]);

  const renderTabContent = () => {
    switch(activeTab) {
      case 'personal_info': return <PersonalInfoTab user={user} certificates={certificates} onEdit={() => setIsEditUserModalOpen(true)} complianceStartYear={complianceStartYear} titles={titles} />;
      case 'profile': return <ProfileTab certificates={certificates} user={user} onDeleteCertificate={onDeleteCertificate} onUpdateCertificate={onUpdateCertificate} onUpdateCertificateOrientation={onUpdateCertificateOrientation} />;
      case 'entry': return <DataEntryTab onAddCertificate={handleAddCertificateAndSwitchTab} />;
      case 'reporting': return <ReportingTab certificates={certificates} users={users} user={user} onUpdateCertificate={onUpdateCertificate} onDeleteCertificate={onDeleteCertificate} onUpdateCertificateOrientation={onUpdateCertificateOrientation} complianceStartYear={complianceStartYear} titles={titles} />;
      case 'ai_assistant': return <AIAssistantTab certificates={certificates} users={users} />;
      case 'admin': return <AdminTab users={users} onAddUser={onAddUser} onUpdateUser={onUpdateUser} onDeleteUser={onDeleteUser} googleSheetUrl={googleSheetUrl} googleFolderUrl={googleFolderUrl} complianceStartYear={complianceStartYear} onUpdateComplianceYear={onUpdateComplianceYear} titles={titles} />;
      default: return null;
    }
  };

  return (
    <>
      <header>
        <h1>Hệ thống Đào tạo Liên tục</h1>
        <div className="user-info">
          <span>Chào, {user.name}</span>
          <button onClick={() => setIsPasswordModalOpen(true)} className="btn btn-logout">
              <span className="material-icons">lock</span>
              <span className="btn-text">Đổi mật khẩu</span>
          </button>
          <button onClick={onLogout} className="btn btn-logout">
            <span className="material-icons">logout</span>
            <span className="btn-text">Đăng xuất</span>
          </button>
        </div>
      </header>
      <div className="main-content">
        <nav className="tabs">
          <ul>
            {tabs.map(tab => (
              <li key={tab.id}>
                <button onClick={() => handleTabClick(tab.id)} className={activeTab === tab.id ? 'active' : ''}>
                  <span className="material-icons">{tab.icon}</span>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="tab-content" ref={mainContentRef}>
          {renderTabContent()}
        </main>
      </div>
       {isPasswordModalOpen && (
            <ChangePasswordModal 
                userId={user.id}
                onSave={onChangePassword}
                onCancel={() => setIsPasswordModalOpen(false)}
            />
        )}
        {isEditUserModalOpen && (
            <UserModal 
                user={user}
                onSave={handleSaveCurrentUser}
                onCancel={() => setIsEditUserModalOpen(false)}
                allDepartments={allDepartments}
                titles={titles}
                isSelfEdit={true}
            />
        )}
    </>
  );
};


const ProcessingOverlay = () => (
    <div className="processing-overlay">
        <div className="spinner"></div>
        <p>Đang xử lý...</p>
    </div>
);

const Navigation = () => (
    <nav className="main-nav">
        <a href="?view=personal_info">Trang chính</a>
        <a href="?view=report">Danh sách NV</a>
    </nav>
);


const App = () => {
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState('');
  
  const [users, setUsers] = useState<User[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isForcePasswordChange, setIsForcePasswordChange] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [googleFolderUrl, setGoogleFolderUrl] = useState('');
  const [complianceStartYear, setComplianceStartYear] = useState(new Date().getFullYear());
  
  useEffect(() => {
    const handleUrlChange = () => {
        setSearchParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const navigate = (view: string, params?: Record<string, string>) => {
      const newParams = new URLSearchParams();
      newParams.set('view', view);
      if (params) {
          for (const key in params) {
              newParams.set(key, params[key]);
          }
      }
      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      window.history.pushState({}, '', newUrl);
      setSearchParams(newParams);
  };

  // Helper to find a property in an object regardless of its case
  const findProp = (obj: any, propNames: string[]) => {
      if (!obj) return undefined;
      for (const name of propNames) {
          if (obj[name] !== undefined && obj[name] !== null && obj[name] !== '') {
              return obj[name];
          }
      }
      return undefined;
  };
  
  // Helper function to parse date strings into YYYY-MM-DD format, correcting for timezones.
  const parseDateToISO = (dateString: string): string => {
    if (!dateString || typeof dateString !== 'string') return '';

    // Attempt to parse the date string. This works well for ISO 8601 formats
    // that come from the backend (e.g., "2023-12-31T17:00:00.000Z").
    const d = new Date(dateString);

    // If the parsed date is valid, format it to 'YYYY-MM-DD'.
    // 'en-CA' locale provides this format and respects the local timezone of the browser.
    if (!isNaN(d.getTime())) {
        try {
            return d.toLocaleDateString('en-CA');
        } catch(e) {
            // Fallback for environments that don't support en-CA
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    // Fallback for non-standard date strings like DD/MM/YYYY which `new Date()` might misinterpret.
    const parts = dateString.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (parts) {
        // Assuming DD/MM/YYYY format
        const day = parts[1].padStart(2, '0');
        const month = parts[2].padStart(2, '0');
        const year = parts[3];
        return `${year}-${month}-${day}`;
    }

    // If it's already in YYYY-MM-DD, return it. This can be a fallback if `new Date` fails.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }

    // Return original string if no format could be reliably parsed.
    return dateString;
  };
  
  const extractGoogleDriveId = (urlOrId: string): string => {
      if (!urlOrId) return '';
      // Check if it's already just an ID (alphanumeric with - and _), typically longer than 25 chars
      if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId)) {
          return urlOrId;
      }
      // Regex to find ID from various Google Drive URL formats (e.g., /file/d/ID/, /uc?id=ID)
      const match = urlOrId.match(/[-\w]{25,}/);
      return match ? match[0] : '';
  };

  const sanitizeUser = (rawUser: any): User | null => {
    if (!rawUser) return null;

    const id = findProp(rawUser, ['id', 'ID']);
    const username = findProp(rawUser, ['username', 'Username']);
    
    if (id === undefined || username === undefined) {
        console.warn('Skipping user due to missing id or username', rawUser);
        return null;
    }
    
    const parsedId = parseInt(String(id), 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        console.warn('Skipping user due to invalid id', { parsedId, rawUser });
        return null;
    }
    
    const roleRaw = String(findProp(rawUser, ['role', 'Role'])).toLowerCase().trim();
    let finalRole: User['role'] = 'user';
    if (roleRaw === 'admin') finalRole = 'admin';
    else if (roleRaw === 'reporter') finalRole = 'reporter';
    else if (roleRaw === 'reporter_user') finalRole = 'reporter_user';

    return {
        id: parsedId,
        username: String(username),
        name: String(findProp(rawUser, ['name', 'Name']) || ''),
        department: String(findProp(rawUser, ['department', 'Department']) || ''),
        role: finalRole,
        password: findProp(rawUser, ['password', 'Password']),
        passwordChangedAt: findProp(rawUser, ['passwordChangedAt', 'passwordchangedat', 'PasswordChangedAt']),
        dateOfBirth: parseDateToISO(String(findProp(rawUser, ['dateOfBirth', 'dateofbirth', 'DateOfBirth']) || '')),
        position: String(findProp(rawUser, ['position', 'Position']) || ''),
        title: String(findProp(rawUser, ['title', 'Title']) || ''),
        practiceCertificateNumber: String(findProp(rawUser, ['practiceCertificateNumber', 'practicecertificatenumber', 'PracticeCertificateNumber']) || ''),
        practiceCertificateIssueDate: parseDateToISO(String(findProp(rawUser, ['practiceCertificateIssueDate', 'practicecertificateissuedate', 'PracticeCertificateIssueDate']) || '')),
        isSuspended: String(findProp(rawUser, ['trạngthái', 'trangthai', 'isSuspended']) || '').trim() === 'Tạm ngừng',
    };
  };
  
  const sanitizeTitle = (rawTitle: any): Title | null => {
      if (!rawTitle) return null;
      const id = findProp(rawTitle, ['id', 'ID']);
      const name = findProp(rawTitle, ['name', 'Name']);
      if (id === undefined || name === undefined) return null;
      return { id: Number(id), name: String(name) };
  };

  const sanitizeCertificate = (rawCert: any): Certificate | null => {
    if (!rawCert) return null;

    const id = findProp(rawCert, ['id', 'ID']);
    const userId = findProp(rawCert, ['userId', 'UserId', 'userid']);
    const imageUrlOrId = findProp(rawCert, ['image', 'Image', 'imageUrl']);
    
    if (id === undefined || userId === undefined) {
        console.warn('Skipping certificate due to missing id or userId', rawCert);
        return null;
    }

    const parsedId = parseInt(String(id).replace(/\D/g, ''), 10);
    const parsedUserId = parseInt(String(userId).replace(/\D/g, ''), 10);

    if (isNaN(parsedId) || isNaN(parsedUserId) || parsedId <= 0 || parsedUserId <= 0) {
        console.warn('Skipping certificate due to invalid id or userId', { parsedId, parsedUserId, rawCert });
        return null;
    }
    
    const creditsRaw = String(findProp(rawCert, ['credits', 'Credits']) || '0').replace(',', '.');
    const creditsParsed = parseFloat(creditsRaw);
    const imageId = extractGoogleDriveId(String(imageUrlOrId || ''));
    const orientation = findProp(rawCert, ['imageorientation', 'imageOrientation']);

    return {
        id: parsedId,
        userId: parsedUserId,
        name: String(findProp(rawCert, ['name', 'Name']) || ''),
        date: parseDateToISO(String(findProp(rawCert, ['date', 'Date']) || '')),
        credits: isNaN(creditsParsed) ? 0 : creditsParsed,
        image: imageId ? `https://lh3.googleusercontent.com/d/${imageId}` : '',
        imageId: imageId || '',
        imageOrientation: orientation ? parseInt(String(orientation), 10) : 1,
    };
  };

  const loadInitialData = useCallback(async () => {
    try {
        const { users: rawUsers, titles: rawTitles, googleSheetUrl, googleFolderUrl, complianceStartYear: startYearFromApi } = await api.fetchInitialData();
        
        const sanitizedUsers = rawUsers.map(sanitizeUser).filter((u): u is User => u !== null);
        const sanitizedTitles = (rawTitles || []).map(sanitizeTitle).filter((t): t is Title => t !== null);

        setUsers(sanitizedUsers);
        setTitles(sanitizedTitles);
        setGoogleSheetUrl(googleSheetUrl);
        setGoogleFolderUrl(googleFolderUrl);
        if (startYearFromApi) {
            setComplianceStartYear(startYearFromApi);
        }
        
        return { sanitizedUsers, sanitizedTitles };
    } catch (error) {
        console.error("Failed to load initial data:", error);
        throw error;
    }
  }, []);
  
  // Effect to load initial lightweight data and check session
  useEffect(() => {
    const initialLoad = async () => {
        setIsLoading(true);
        try {
            const loadedData = await loadInitialData();
            if(!loadedData) return;

            const { sanitizedUsers } = loadedData;
            const storedUserJson = sessionStorage.getItem('currentUser');
            if (storedUserJson) {
                const storedUser = JSON.parse(storedUserJson);
                const matchingUser = sanitizedUsers.find(u => u.id === Number(storedUser.id));
                 if (matchingUser) {
                    setCurrentUser(matchingUser);
                    if (!matchingUser.passwordChangedAt) {
                        setIsForcePasswordChange(true);
                    }
                } else {
                    setCurrentUser(null);
                }
            }

        } catch (error) {
            console.error("Failed to perform initial load:", error);
            setLoginError("Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại sau.");
        } finally {
            setIsLoading(false);
        }
    };
    initialLoad();
  }, [loadInitialData]);

    // Effect to load heavy certificate data after user is logged in
    useEffect(() => {
        const loadCertificates = async () => {
            if (currentUser) {
                try {
                    const rawCertificates = await api.fetchCertificates();
                    const sanitizedCertificates = rawCertificates.map(sanitizeCertificate).filter((c): c is Certificate => c !== null);
                    setCertificates(sanitizedCertificates);
                } catch (error) {
                     console.error("Failed to load certificates:", error);
                     alert('Lỗi: Không thể tải danh sách chứng chỉ.');
                }
            }
        };
        loadCertificates();
    }, [currentUser]);

  const handleLogin = async (username: string, password: string) => {
    setLoginError('');
    setIsProcessing(true);
    try {
        // The login API now returns the initial data payload
        const { loggedInUser, users: rawUsers, titles: rawTitles, googleSheetUrl, googleFolderUrl, complianceStartYear: startYearFromApi } = await api.login(username, password);
        
        // Sanitize and set state with the data from the login response
        const sanitizedUsers = rawUsers.map(sanitizeUser).filter((u): u is User => u !== null);
        const sanitizedTitles = (rawTitles || []).map(sanitizeTitle).filter((t): t is Title => t !== null);

        setUsers(sanitizedUsers);
        setTitles(sanitizedTitles);
        setGoogleSheetUrl(googleSheetUrl);
        setGoogleFolderUrl(googleFolderUrl);
        if (startYearFromApi) setComplianceStartYear(startYearFromApi);

        // Find the current user from the newly loaded full list to ensure data consistency
        const matchedUser = sanitizedUsers.find(u => u.id === Number(loggedInUser.id));
        if (matchedUser) {
            setCurrentUser(matchedUser);
            sessionStorage.setItem('currentUser', JSON.stringify(matchedUser));
            if (!matchedUser.passwordChangedAt) {
                setIsForcePasswordChange(true);
            } else {
                const defaultView = matchedUser.role === 'reporter' ? 'reporting' : 'personal_info';
                navigate(defaultView);
            }
        } else {
             setLoginError('Đăng nhập thành công nhưng không thể tải dữ liệu người dùng.');
        }

    } catch (error: any) {
        setLoginError(error.message || 'Đã xảy ra lỗi khi đăng nhập.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
    navigate('login');
  }, []);

  const handleAddCertificate = useCallback(async (newCert: NewCertificatePayload) => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
        const newCertFromApi = await api.addCertificate(newCert, currentUser.id, currentUser.name);
        const sanitizedCert = sanitizeCertificate(newCertFromApi);
        if(sanitizedCert) {
            setCertificates(prev => [...prev, sanitizedCert]);
        }
        alert('Thêm chứng chỉ thành công!');
    } catch (error: any) {
        console.error("Failed to add certificate:", error);
        alert(`Thêm chứng chỉ thất bại: ${error.message || 'Vui lòng thử lại.'}`);
        throw error;
    } finally {
        setIsProcessing(false);
    }
  }, [currentUser]);

  const handleUpdateCertificate = useCallback(async (updatedCert: Certificate, newImageFile?: File, newImageOrientation?: number) => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
        let payload: any = { ...updatedCert, modifiedByUserId: currentUser.id };

        if (newImageFile) {
            const imageBase64 = await api.fileToBase64(newImageFile);
            
            const now = new Date();
            const dateStr = now.getFullYear().toString() + 
                            (now.getMonth() + 1).toString().padStart(2, '0') + 
                            now.getDate().toString().padStart(2, '0');
            const timeStr = now.getHours().toString().padStart(2, '0') + 
                            now.getMinutes().toString().padStart(2, '0') + 
                            now.getSeconds().toString().padStart(2, '0');
            const extension = newImageFile.name.split('.').pop() || 'jpg';
            const newImageName = `${currentUser.name.replace(/\s/g, '_')}_${dateStr}_${timeStr}.${extension}`;

            payload.newImageBase64 = imageBase64;
            payload.newImageType = newImageFile.type;
            payload.newImageName = newImageName;
            payload.orientation = newImageOrientation;
        }
        const updatedCertFromApi = await api.updateCertificate(payload);
        const sanitizedCert = sanitizeCertificate(updatedCertFromApi);
        if (sanitizedCert) {
             setCertificates(prev => prev.map(c => c.id === sanitizedCert.id ? sanitizedCert : c));
        }
        alert('Cập nhật chứng chỉ thành công!');
    } catch (error: any) {
        console.error("Failed to update certificate:", error);
        alert(`Cập nhật chứng chỉ thất bại: ${error.message || 'Đã có lỗi xảy ra.'}`);
    } finally {
        setIsProcessing(false);
    }
  }, [currentUser]);

  const handleUpdateCertificateOrientation = useCallback(async (certId: number, orientation: number) => {
      setIsProcessing(true);
      try {
          const updatedCertFromApi = await api.updateCertificateOrientation(certId, orientation);
          const sanitizedCert = sanitizeCertificate(updatedCertFromApi);
          if (sanitizedCert) {
              setCertificates(prev => prev.map(c => c.id === sanitizedCert.id ? sanitizedCert : c));
          }
      } catch (error: any) {
          console.error("Failed to update certificate orientation:", error);
          alert(`Lưu hướng xoay thất bại: ${error.message}`);
          throw error;
      } finally {
          setIsProcessing(false);
      }
  }, []);

  const handleDeleteCertificate = useCallback(async (id: number) => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
        const deletedId = await api.deleteCertificate(id, currentUser.id);
        setCertificates(prev => prev.filter(c => c.id !== deletedId));
    } catch (error: any) {
        console.error("Failed to delete certificate:", error);
        alert(`Xóa chứng chỉ thất bại: ${error.message || 'Đã có lỗi xảy ra.'}`);
    } finally {
        setIsProcessing(false);
    }
  }, [currentUser]);

  const handleAddUser = useCallback(async (newUser: NewUser) => {
    setIsProcessing(true);
    try {
        const newUserFromApi = await api.addUser(newUser);
        const sanitizedUser = sanitizeUser(newUserFromApi);
        if(sanitizedUser) {
            setUsers(prev => [...prev, sanitizedUser]);
        }
        alert('Thêm người dùng thành công!');
    } catch (error: any) {
        console.error("Failed to add user:", error);
        alert(`Thêm người dùng thất bại: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  }, []);

  const handleUpdateUser = useCallback(async (updatedUser: User) => {
    setIsProcessing(true);
     try {
        const updatedUserFromApi = await api.updateUser(updatedUser);
        const sanitizedUser = sanitizeUser(updatedUserFromApi);

        if(sanitizedUser) {
            setUsers(prev => prev.map(u => u.id === sanitizedUser.id ? sanitizedUser : u));
            if (currentUser && currentUser.id === sanitizedUser.id) {
                setCurrentUser(sanitizedUser);
                sessionStorage.setItem('currentUser', JSON.stringify(sanitizedUser));
            }
        }
        alert('Cập nhật người dùng thành công!');
     } catch (error: any)        {
        console.error("Failed to update user:", error);
        alert(`Cập nhật người dùng thất bại: ${error.message}`);
     } finally {
        setIsProcessing(false);
     }
  }, [currentUser]);

  const handleDeleteUser = useCallback(async (userId: number) => {
    setIsProcessing(true);
     try {
        const deletedUserId = await api.deleteUser(userId);
        setUsers(prev => prev.filter(u => u.id !== deletedUserId));
        setCertificates(prev => prev.filter(c => c.userId !== deletedUserId)); // Also remove certificates locally
        alert('Xóa người dùng thành công!');
        if (currentUser && currentUser.id === userId) {
            handleLogout();
        }
     } catch (error: any) {
        console.error("Failed to delete user:", error);
        alert(`Xóa người dùng thất bại: ${error.message || 'Đã có lỗi xảy ra.'}`);
     } finally {
        setIsProcessing(false);
     }
  }, [currentUser, handleLogout]);

  const handleChangePassword = useCallback(async (userId: number, oldPass: string, newPass: string) => {
      setIsProcessing(true);
      try {
          await api.changePassword(userId, oldPass, newPass);
          if (currentUser && currentUser.id === userId) {
                const updatedUser = { ...currentUser, passwordChangedAt: new Date().toISOString() };
                setCurrentUser(updatedUser);
                sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }
          alert('Đổi mật khẩu thành công!');
      } catch (error: any) {
          console.error("Failed to change password:", error);
          throw error;
      } finally {
        setIsProcessing(false);
      }
  }, [currentUser]);
  
  const handleUpdateComplianceYear = useCallback(async (newYear: number) => {
    setIsProcessing(true);
    try {
        const result = await api.updateComplianceYear(newYear);
        setComplianceStartYear(result.newYear);
        alert('Cập nhật năm bắt đầu chu kỳ thành công!');
    } catch (error: any) {
        console.error("Failed to update compliance year:", error);
        alert(`Cập nhật thất bại: ${error.message}`);
        throw error; // re-throw to let caller know it failed
    } finally {
        setIsProcessing(false);
    }
  }, []);


  if (isLoading) {
    return (
        <div className="loading-container">
            <h1>Đang tải dữ liệu...</h1>
        </div>
    );
  }
  
  const view = searchParams.get('view');
  const id = searchParams.get('id');

  if (view === 'report-viewer' && id) {
    return <ReportViewer id={id} />;
  }

  if (view === 'report') {
    return <Report />;
  }

  const handleForcedPasswordSave = async (userId: number, oldPass: string, newPass: string) => {
      await handleChangePassword(userId, oldPass, newPass);
      // On success, update local state to exit forced change mode
      if (currentUser) {
          const updatedUser = { ...currentUser, passwordChangedAt: new Date().toISOString() };
          setCurrentUser(updatedUser);
          sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
          setIsForcePasswordChange(false);
          const defaultView = updatedUser.role === 'reporter' ? 'reporting' : 'personal_info';
          navigate(defaultView);
      }
  };

  const defaultViewForCurrentUser = currentUser ? (currentUser.role === 'reporter' ? 'reporting' : 'personal_info') : 'login';
  const activeView = view || defaultViewForCurrentUser;

  return (
    <>
      <Navigation />
      <div className={`app-container ${!currentUser ? 'login-view' : ''}`}>
        {isProcessing && <ProcessingOverlay />}
        {currentUser && isForcePasswordChange ? (
             <div className="forced-password-change-container">
                <ChangePasswordModal 
                    userId={currentUser.id}
                    onSave={handleForcedPasswordSave}
                    onCancel={() => {}} // Cannot cancel
                    isForced={true}
                />
            </div>
        ) : currentUser ? (
          <MainApp 
              user={currentUser} 
              users={users}
              certificates={certificates}
              titles={titles}
              activeTab={activeView}
              onNavigate={navigate}
              onLogout={handleLogout}
              onAddCertificate={handleAddCertificate}
              onUpdateCertificate={handleUpdateCertificate}
              onUpdateCertificateOrientation={handleUpdateCertificateOrientation}
              onDeleteCertificate={handleDeleteCertificate}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onChangePassword={handleChangePassword}
              onUpdateComplianceYear={handleUpdateComplianceYear}
              googleSheetUrl={googleSheetUrl}
              googleFolderUrl={googleFolderUrl}
              complianceStartYear={complianceStartYear}
          />
        ) : (
          <LoginPage onLogin={handleLogin} error={loginError} />
        )}
      </div>
      <footer className="app-footer">
          <p>Design by Nguyễn Trung Thành</p>
      </footer>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}