import React, { useState, useMemo } from 'react';
import { UserData, Certificate, Department, Title } from '../App';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import CertificateEditModal from '../components/CertificateEditModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import ImagePreviewModal from '../components/ImagePreviewModal';

interface InspectionProps {
    currentUser: UserData;
    allUsers: UserData[];
    allCertificates: Certificate[];
    departments: Department[];
    titles: Title[];
    onCertificateUpdate: (updatedData: Partial<Certificate>, originalCert: Certificate) => void;
    onCertificateDelete: (certId: string) => void;
    geminiApiKey: string | null;
}

const formatDate = (dateObj: { toDate: () => Date }) => {
    if (!dateObj) return '';
    return dateObj.toDate().toLocaleDateString('vi-VN');
};

const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const Inspection: React.FC<InspectionProps> = ({ currentUser, allUsers, allCertificates, departments, titles, onCertificateUpdate, onCertificateDelete, geminiApiKey }) => {
    const [activeMode, setActiveMode] = useState<'certificate' | 'personnel'>('certificate');
    
    // State for certificate search
    const [certSearchTerm, setCertSearchTerm] = useState('');
    const [selectedCertificateName, setSelectedCertificateName] = useState<string | null>(null);

    // State for personnel search
    const [personnelSearchTerm, setPersonnelSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

    // State for modals
    const [editingItem, setEditingItem] = useState<{ user: UserData; certificate: Certificate } | null>(null);
    const [deletingItem, setDeletingItem] = useState<{ user: UserData; certificate: Certificate } | null>(null);
    const [imagePreviewData, setImagePreviewData] = useState<{ images: Certificate[], initialIndex: number } | null>(null);


    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const titleMap = useMemo(() => new Map(titles.map(t => [t.id, t.name])), [titles]);

    // --- Certificate Search Logic ---
    const uniqueCertificateNames = useMemo(() => {
        return [...new Set(allCertificates.map(c => c.name))].sort((a, b) => a.localeCompare(b, 'vi'));
    }, [allCertificates]);

    const certSearchResults = useMemo(() => {
        if (!certSearchTerm || activeMode !== 'certificate') return [];
        const normalizedSearch = normalizeText(certSearchTerm);
        return uniqueCertificateNames
            .filter(name => normalizeText(name).includes(normalizedSearch))
            .slice(0, 10);
    }, [certSearchTerm, uniqueCertificateNames, activeMode]);

    const usersWithSelectedCertificate = useMemo(() => {
        if (!selectedCertificateName || activeMode !== 'certificate') return [];
        const userMap = new Map(allUsers.map(u => [u.id, u]));
        
        return allCertificates
            .filter(cert => cert.name === selectedCertificateName)
            .map(certificate => ({
                user: userMap.get(certificate.userId),
                certificate
            }))
            .filter((item): item is { user: UserData; certificate: Certificate } => !!item.user && item.user.status !== 'disabled')
            // FIX: Property 'localeCompare' does not exist on type 'unknown'.
            .sort((a, b) => String(a.user.name).localeCompare(String(b.user.name), 'vi'));
    }, [selectedCertificateName, allCertificates, allUsers, activeMode]);
    
    // --- Personnel Search Logic ---
    const personnelSearchResults = useMemo(() => {
        if (!personnelSearchTerm || activeMode !== 'personnel') return [];
        const normalizedSearch = normalizeText(personnelSearchTerm);
        return allUsers
            .filter(user => user.status !== 'disabled' && user.role !== 'admin' && user.role !== 'reporter' && normalizeText(user.name).includes(normalizedSearch))
            .slice(0, 10);
    }, [personnelSearchTerm, allUsers, activeMode]);

    const certificatesOfSelectedUser = useMemo(() => {
        if (!selectedUser || activeMode !== 'personnel') return [];
        return allCertificates
            .filter(cert => cert.userId === selectedUser.id)
            .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
    }, [selectedUser, allCertificates, activeMode]);


    // --- Handlers ---
    const switchMode = (mode: 'certificate' | 'personnel') => {
        setActiveMode(mode);
        setCertSearchTerm('');
        setSelectedCertificateName(null);
        setPersonnelSearchTerm('');
        setSelectedUser(null);
    };

    const handleSelectCertificateName = (name: string) => {
        setSelectedCertificateName(name);
        setCertSearchTerm('');
    };
    
    const handleSelectUser = (user: UserData) => {
        setSelectedUser(user);
        setPersonnelSearchTerm('');
    };

    const handleUpdateCertificate = (updatedData: Partial<Certificate>) => {
        if (editingItem) {
            onCertificateUpdate(updatedData, editingItem.certificate);
            setEditingItem(null);
        }
    };

    const handleDeleteCertificate = () => {
        if (deletingItem) {
            onCertificateDelete(deletingItem.certificate.id);
            setDeletingItem(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="border-b border-gray-200 mb-4">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button 
                            onClick={() => switchMode('certificate')}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-base ${activeMode === 'certificate' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Tìm theo Chứng chỉ
                        </button>
                        <button 
                            onClick={() => switchMode('personnel')}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-base ${activeMode === 'personnel' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Tìm theo Nhân sự
                        </button>
                    </nav>
                </div>
                
                {activeMode === 'certificate' && (
                    <div>
                        <label htmlFor="search-certificate" className="block text-base font-semibold text-gray-700 mb-2">Tìm kiếm chứng chỉ</label>
                        <div className="relative">
                            <input id="search-certificate" type="text" placeholder="Nhập tên chứng chỉ để xem danh sách nhân viên..." value={certSearchTerm} onChange={(e) => { setCertSearchTerm(e.target.value); if (selectedCertificateName) setSelectedCertificateName(null); }} className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                            {certSearchResults.length > 0 && (
                                <ul className="absolute z-10 w-full max-w-lg mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                                    {certSearchResults.map(name => ( <li key={name} onClick={() => handleSelectCertificateName(name)} className="px-4 py-3 cursor-pointer hover:bg-teal-50"><p className="font-semibold text-gray-800">{name}</p></li> ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
                
                {activeMode === 'personnel' && (
                    <div>
                        <label htmlFor="search-personnel" className="block text-base font-semibold text-gray-700 mb-2">Tìm kiếm nhân sự</label>
                        <div className="relative">
                            <input id="search-personnel" type="text" placeholder="Nhập tên nhân viên để xem danh sách chứng chỉ..." value={personnelSearchTerm} onChange={(e) => { setPersonnelSearchTerm(e.target.value); if (selectedUser) setSelectedUser(null); }} className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                             {personnelSearchResults.length > 0 && (
                                <ul className="absolute z-10 w-full max-w-lg mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                                    {personnelSearchResults.map(user => ( <li key={user.id} onClick={() => handleSelectUser(user)} className="px-4 py-3 cursor-pointer hover:bg-teal-50"><p className="font-semibold text-gray-800">{user.name}</p></li> ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {activeMode === 'certificate' && (selectedCertificateName ? (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Nhân viên có chứng chỉ: <span className="text-teal-600">{selectedCertificateName}</span></h3>
                    {usersWithSelectedCertificate.length > 0 ? (
                        <div className="overflow-x-auto"><table className="min-w-full bg-white border">
                            <thead className="bg-gray-50"><tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b w-12">STT</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Họ và tên</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Khoa/Phòng</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Chức danh</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Ngày cấp</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Số tiết</th>
                                {currentUser.role === 'admin' && <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Hành động</th>}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-200">{usersWithSelectedCertificate.map(({ user, certificate }, index) => (<tr key={certificate.id}>
                                <td className="px-4 py-3 text-center">{index + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-900"><button onClick={() => setImagePreviewData({ images: usersWithSelectedCertificate.map(item => item.certificate), initialIndex: index })} className="text-left text-teal-600 hover:text-teal-800 hover:underline focus:outline-none" disabled={!certificate.imageUrl} title={!certificate.imageUrl ? "Không có ảnh" : "Xem ảnh chứng chỉ"}>{user.name}</button></td>
                                <td className="px-4 py-3">{departmentMap.get(user.departmentId) || 'N/A'}</td>
                                <td className="px-4 py-3">{titleMap.get(user.titleId) || 'N/A'}</td>
                                <td className="px-4 py-3">{formatDate(certificate.date)}</td>
                                <td className="px-4 py-3">{certificate.credits}</td>
                                {currentUser.role === 'admin' && (<td className="px-4 py-3 whitespace-nowrap">
                                    <button onClick={() => setEditingItem({ user, certificate })} className="text-teal-600 hover:text-teal-900 mr-4"><PencilIcon className="h-5 w-5" /></button>
                                    <button onClick={() => setDeletingItem({ user, certificate })} className="text-red-600 hover:text-red-900"><TrashIcon className="h-5 w-5" /></button>
                                </td>)}
                            </tr>))}</tbody>
                        </table></div>
                    ) : <p className="text-gray-500">Không có nhân viên nào có chứng chỉ này.</p>}
                </div>
            ) : <div className="text-center text-gray-500 py-6"><p>Gõ vào ô tìm kiếm và chọn một chứng chỉ để xem danh sách nhân viên.</p></div>)}
            
            {activeMode === 'personnel' && (selectedUser ? (
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Danh sách chứng chỉ của: <span className="text-teal-600">{selectedUser.name}</span></h3>
                    {certificatesOfSelectedUser.length > 0 ? (
                        <div className="overflow-x-auto"><table className="min-w-full bg-white border">
                            <thead className="bg-gray-50"><tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b w-12">STT</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Tên chứng chỉ</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Ngày cấp</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Số tiết</th>
                                {currentUser.role === 'admin' && <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b">Hành động</th>}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-200">{certificatesOfSelectedUser.map((certificate, index) => (<tr key={certificate.id}>
                                <td className="px-4 py-3 text-center">{index + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-900"><button onClick={() => setImagePreviewData({ images: certificatesOfSelectedUser, initialIndex: index })} className="text-left text-teal-600 hover:text-teal-800 hover:underline focus:outline-none" disabled={!certificate.imageUrl} title={!certificate.imageUrl ? "Không có ảnh" : "Xem ảnh chứng chỉ"}>{certificate.name}</button></td>
                                <td className="px-4 py-3">{formatDate(certificate.date)}</td>
                                <td className="px-4 py-3">{certificate.credits}</td>
                                {currentUser.role === 'admin' && (<td className="px-4 py-3 whitespace-nowrap">
                                    <button onClick={() => setEditingItem({ user: selectedUser, certificate })} className="text-teal-600 hover:text-teal-900 mr-4"><PencilIcon className="h-5 w-5" /></button>
                                    <button onClick={() => setDeletingItem({ user: selectedUser, certificate })} className="text-red-600 hover:text-red-900"><TrashIcon className="h-5 w-5" /></button>
                                </td>)}
                            </tr>))}</tbody>
                        </table></div>
                    ) : <p className="text-gray-500">Nhân viên này chưa có chứng chỉ nào.</p>}
                </div>
            ) : <div className="text-center text-gray-500 py-6"><p>Gõ vào ô tìm kiếm và chọn một nhân viên để xem danh sách chứng chỉ.</p></div>)}
            
            {editingItem && (
                <CertificateEditModal
                    user={editingItem.user}
                    certificate={editingItem.certificate}
                    onSave={handleUpdateCertificate}
                    onClose={() => setEditingItem(null)}
                    geminiApiKey={geminiApiKey}
                />
            )}

            {deletingItem && (
                <ConfirmDeleteModal
                    message={`Bạn có chắc chắn muốn xóa chứng chỉ "${deletingItem.certificate.name}" của ${deletingItem.user.name}?`}
                    onConfirm={handleDeleteCertificate}
                    onClose={() => setDeletingItem(null)}
                />
            )}

            {imagePreviewData && (
                <ImagePreviewModal
                    images={imagePreviewData.images}
                    initialIndex={imagePreviewData.initialIndex}
                    onClose={() => setImagePreviewData(null)}
                />
            )}
        </div>
    );
};

export default Inspection;