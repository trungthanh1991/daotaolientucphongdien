// FIX: Import useState and useEffect from React to resolve reference errors.
import React, { useState, useEffect } from 'react';
import { UserData, Department, Title, AppSettings, Certificate } from '../App';
import PencilIcon from '../components/icons/PencilIcon';
import ProfileEditModal from '../components/ProfileEditModal';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface ProfileProps {
    user: UserData;
    onUserUpdate: (updatedUser: UserData) => void;
    departments: Department[];
    titles: Title[];
    settings: AppSettings | null;
}

// Helper component for displaying detailed information with better styling
const InfoField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div>
        <label className="text-base font-medium text-gray-500">{label}</label>
        {value ? (
             <p className="text-lg font-semibold text-indigo-900 mt-1">{value}</p>
        ) : (
             <p className="text-lg text-gray-500 italic mt-1">Chưa cập nhật</p>
        )}
    </div>
);

const formatDate = (dateObj: { toDate: () => Date } | undefined | Date) => {
    if (!dateObj) return null;
    const date = dateObj instanceof Date ? dateObj : dateObj.toDate();
    return date.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
};

const capitalizeName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};


const Profile: React.FC<ProfileProps> = ({ user, onUserUpdate, departments, titles, settings }) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [userCredits, setUserCredits] = useState(0);
    const [loadingCredits, setLoadingCredits] = useState(true);
    const [creditsError, setCreditsError] = useState<string | null>(null);
    
    const departmentName = departments.find(d => d.id === user.departmentId)?.name;
    const titleName = titles.find(t => t.id === user.titleId)?.name;
    const userInitials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

    useEffect(() => {
        if (!user?.id) {
            setLoadingCredits(false);
            return;
        }

        const fetchUserCredits = async () => {
            setLoadingCredits(true);
            setCreditsError(null);
            try {
                const certsCollection = collection(db, 'Certificates');
                const q = query(certsCollection, where('userId', '==', user.id));
                const querySnapshot = await getDocs(q);
                let totalCredits = 0;
                querySnapshot.forEach(doc => {
                    const cert = doc.data();
                    const docId = doc.id;
                    if (typeof cert.credits !== 'number') {
                        console.error(`Validation Error: Certificate document '${docId}' for user '${user.id}' has invalid 'credits'. Skipping for credit calculation.`);
                        return;
                    }

                    const certYear = cert.date.toDate().getFullYear();
                    if (settings && certYear >= settings.complianceStartYear && certYear <= settings.complianceEndYear) {
                        totalCredits += cert.credits;
                    }
                });
                setUserCredits(totalCredits);
            } catch (error) {
                console.error("Error fetching user credits:", error);
                const message = error instanceof Error ? error.message : "Lỗi không xác định.";
                setCreditsError(`Không thể tải dữ liệu tín chỉ. ${message}`);
            } finally {
                setLoadingCredits(false);
            }
        };

        if (settings) {
            fetchUserCredits();
        } else {
            setLoadingCredits(false);
        }
    }, [user.id, settings]);

    const handleSaveProfile = async (updatedData: Partial<UserData>) => {
        try {
            const userDocRef = doc(db, 'Users', user.id);
            await updateDoc(userDocRef, updatedData);

            const updatedUser = { ...user, ...updatedData };

            if (updatedData.practiceCertificateIssueDate) {
                updatedUser.practiceCertificateIssueDate = { toDate: () => new Date(updatedData.practiceCertificateIssueDate as any) };
            }
            if (updatedData.dateOfBirth) {
                updatedUser.dateOfBirth = { toDate: () => new Date(updatedData.dateOfBirth as any) };
            }

            onUserUpdate(updatedUser);
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error updating profile: ", error);
        }
    };
    
    const isPharmacist = user.titleId === '4'; // ID for Dược sĩ
    const complianceTarget = isPharmacist ? 8 : 120;
    const creditsNeeded = Math.max(0, complianceTarget - userCredits);
    const progressPercentage = complianceTarget > 0 ? Math.min(100, (userCredits / complianceTarget) * 100) : 0;
    
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (progressPercentage / 100) * circumference;

    return (
        <>
            <div className="space-y-8">
                <h1 className="text-3xl font-bold text-indigo-900">Thông tin Cá nhân</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Main Info Card */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-center sm:justify-between p-6 bg-gradient-to-r from-teal-600 to-sky-600 gap-4">
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 rounded-full bg-teal-500 text-white flex items-center justify-center text-4xl font-bold flex-shrink-0 ring-4 ring-white shadow-md">
                                    {userInitials}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-white tracking-tight">{capitalizeName(user.name)}</h2>
                                    <p className="text-lg font-medium text-teal-100 mt-1">{titleName || 'Chưa có chức danh'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsEditModalOpen(true)}
                                className="bg-white/20 backdrop-blur-sm text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-white/30 transition-colors w-full sm:w-auto"
                            >
                                <PencilIcon className="h-5 w-5" />
                                <span>Chỉnh sửa</span>
                            </button>
                        </div>
                        
                        <div className="p-6 md:p-8">
                            <h3 className="text-xl font-semibold text-indigo-800 mb-6">Thông tin chi tiết</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                <InfoField label="Khoa/Phòng" value={departmentName} />
                                <InfoField label="Chức vụ" value={user.position} />
                                <InfoField label="Ngày sinh" value={formatDate(user.dateOfBirth)} /> 
                                <InfoField label="Số CCHN" value={user.practiceCertificateNumber} />
                                <InfoField label="Ngày cấp CCHN" value={formatDate(user.practiceCertificateIssueDate)} />
                            </div>
                        </div>
                    </div>

                    {/* Progress Card */}
                    <div className="lg:col-span-1 bg-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col items-center">
                         <h3 className="text-xl font-semibold text-indigo-800 mb-2">Tiến độ Chu kỳ Tuân thủ</h3>
                         {loadingCredits ? (
                            <div className="flex items-center justify-center h-48">
                                <p className="text-gray-500">Đang tải dữ liệu...</p>
                            </div>
                         ) : creditsError ? (
                            <div className="flex items-center justify-center h-48">
                                <p className="text-red-500 text-center px-4">{creditsError}</p>
                            </div>
                         ) : settings ? (
                            <>
                                <p className="font-bold text-gray-600 mb-4">{settings.complianceStartYear} - {settings.complianceEndYear}</p>
                                <div className="relative w-48 h-48 my-4">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle className="text-gray-200" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="96" cy="96" />
                                        <circle
                                            className="text-indigo-500"
                                            strokeWidth="12"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={progressOffset}
                                            strokeLinecap="round"
                                            stroke="currentColor"
                                            fill="transparent"
                                            r={radius}
                                            cx="96"
                                            cy="96"
                                            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                         <span className="text-4xl font-bold text-indigo-600">{userCredits}</span>
                                         <span className="text-base text-gray-500">/{complianceTarget} tiết</span>
                                    </div>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">{progressPercentage.toFixed(0)}%</p>
                                <p className="text-gray-500 mb-4">Hoàn thành</p>
                                
                                <div className="mt-auto pt-4 text-center">
                                    {creditsNeeded > 0 ? (
                                        <p className="text-base text-gray-600">
                                            Bạn cần thêm <span className="font-bold text-rose-600">{creditsNeeded}</span> tiết để hoàn thành.
                                        </p>
                                    ) : (
                                        <p className="font-semibold text-emerald-600">
                                            🎉 Chúc mừng! Bạn đã hoàn thành chu kỳ.
                                        </p>
                                    )}
                                </div>
                            </>
                         ) : (
                            <p className="text-red-500">Không thể tải thông tin chu kỳ.</p>
                         )}
                    </div>
                </div>
            </div>

            {isEditModalOpen && (
                <ProfileEditModal 
                    user={user}
                    departments={departments}
                    titles={titles}
                    onSave={handleSaveProfile}
                    onClose={() => setIsEditModalOpen(false)}
                />
            )}
        </>
    );
};

export default Profile;