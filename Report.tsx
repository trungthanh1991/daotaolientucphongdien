import React, { useState, useEffect, useMemo, useRef } from "react";
// FIX: Use a standard ES module import for qrcode.react. The `import = require()` syntax is not compatible with ECMAScript module targets.
// Fix: Changed from default import to a named import `QRCodeSVG` to resolve JSX component type errors.
import { QRCodeSVG as QRCode } from "qrcode.react";

// --- Type definitions (assuming these are shared or passed down) ---
interface ReportUser {
    id: number;
    name: string;
    department: string;
    role?: string;
    isSuspended?: boolean;
}

interface Certificate {
  id: number;
  userId: number;
  name: string;
  date: string;
  credits: number;
}

// Define the shape of the API object we need to pass down
interface ShareApi {
    createShareableLink: (userId: number) => Promise<{ success: boolean; url: string }>;
}


// Helper function to normalize text for searching (remove accents, lowercase)
const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const ShareModal = ({ user, onClose, api }: { user: ReportUser, onClose: () => void, api: ShareApi }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [qrUrl, setQrUrl] = useState('');
    const [error, setError] = useState('');
    const urlInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const generateLink = async () => {
            try {
                const result = await api.createShareableLink(user.id);
                if (result.success) {
                    setQrUrl(result.url);
                } else {
                    throw new Error("Không thể tạo liên kết từ máy chủ.");
                }
            } catch (err: any) {
                setError(err.message || "Đã xảy ra lỗi khi tạo liên kết chia sẻ.");
            } finally {
                setIsLoading(false);
            }
        };
        generateLink();
    }, [user.id, api]);

    const handleCopy = () => {
        if (urlInputRef.current) {
            urlInputRef.current.select();
            document.execCommand('copy');
            alert('Đã sao chép liên kết!');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content share-modal-content" onClick={e => e.stopPropagation()}>
                <h2>Chia sẻ báo cáo của {user.name}</h2>
                {isLoading && <div className="spinner" style={{ margin: '40px auto' }}></div>}
                {error && <p className="error">{error}</p>}
                {qrUrl && (
                    <>
                        <p>Sử dụng mã QR hoặc sao chép liên kết bên dưới để chia sẻ báo cáo này.</p>
                        <div className="qr-code-container">
                            <QRCode value={qrUrl} size={256} />
                        </div>
                        <div className="share-url-container">
                            <input ref={urlInputRef} type="text" value={qrUrl} readOnly />
                            <button className="btn btn-secondary" onClick={handleCopy}>
                                <span className="material-icons">content_copy</span> Sao chép
                            </button>
                        </div>
                    </>
                )}
                <div className="modal-actions" style={{justifyContent: 'center'}}>
                    <button className="btn btn-primary" onClick={onClose}>Đóng</button>
                </div>
            </div>
        </div>
    );
};


export function Report({ allUsers, allCertificates, api }: { allUsers: ReportUser[], allCertificates: Certificate[], api: ShareApi }) {
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingUser, setViewingUser] = useState<ReportUser | null>(null);

  const reportUsers = useMemo(() => {
      return allUsers.filter((u: ReportUser) => 
          u.role !== 'admin' && u.role !== 'reporter' && !u.isSuspended
      );
  }, [allUsers]);

  const departments = useMemo(() => {
    const depts = new Set(reportUsers.map(u => u.department));
    return ["all", ...Array.from(depts).sort()];
  }, [reportUsers]);

  const userCreditTotals = useMemo(() => {
    const totals: { [key: number]: number } = {};
    for (const cert of allCertificates) {
        totals[cert.userId] = (totals[cert.userId] || 0) + Number(cert.credits || 0);
    }
    return totals;
  }, [allCertificates]);
  
  const filteredUsers = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return reportUsers.filter(u => {
        const departmentMatch = filterDepartment === "all" || u.department === filterDepartment;
        const nameMatch = normalizedSearch === '' || normalizeText(u.name).includes(normalizedSearch);
        return departmentMatch && nameMatch;
    });
  }, [reportUsers, filterDepartment, searchTerm]);

  return (
    <>
      <div className="report-page-container">
        <h2>Danh sách nhân viên</h2>
        
        <div className="report-filters">
            <div className="filter-item">
                <label htmlFor="dept-filter">Lọc theo Khoa/Phòng:</label>
                <select
                    id="dept-filter"
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                >
                    {departments.map(dept => (
                        <option key={dept} value={dept}>
                            {dept === "all" ? "Tất cả Khoa/Phòng" : dept}
                        </option>
                    ))}
                </select>
            </div>
             <div className="filter-item">
                <label htmlFor="name-search">Tìm theo tên:</label>
                <input
                    id="name-search"
                    type="search"
                    placeholder="Nhập tên nhân viên..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {allUsers.length === 0 ? (
            <p>Đang tải danh sách nhân viên...</p>
        ) : (
            <div className="report-viewer-table-container">
                <table className="report-viewer-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Họ và Tên</th>
                            <th>Khoa/Phòng</th>
                            <th>Tổng số tiết</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user, index) => {
                            const totalCredits = userCreditTotals[user.id] || 0;
                            return (
                                <tr key={user.id}>
                                    <td data-label="STT">{index + 1}</td>
                                    <td data-label="Họ và Tên">{user.name}</td>
                                    <td data-label="Khoa/Phòng">{user.department}</td>
                                    <td data-label="Tổng số tiết">
                                        {Number.isInteger(totalCredits) ? totalCredits : totalCredits.toFixed(1)}
                                    </td>
                                    <td data-label="Hành động">
                                        <button className="btn btn-secondary" style={{padding: '6px 12px', fontSize: '14px'}} onClick={() => setViewingUser(user)}>Xem</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
      </div>
      {viewingUser && (
        <UserDetailsModal 
            user={viewingUser}
            allCertificates={allCertificates}
            onClose={() => setViewingUser(null)}
            api={api}
        />
      )}
    </>
  );
}


const UserDetailsModal = ({ user, allCertificates, onClose, api }: { user: ReportUser, allCertificates: Certificate[], onClose: () => void, api: ShareApi }) => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const userCerts = useMemo(() => allCertificates.filter(c => c.userId === user.id), [allCertificates, user.id]);
    
    const allTimeTotals = useMemo(() => {
        const totalCredits = userCerts.reduce((sum, cert) => sum + Number(cert.credits || 0), 0);
        return {
            count: userCerts.length,
            credits: Number.isInteger(totalCredits) ? totalCredits : totalCredits.toFixed(1)
        };
    }, [userCerts]);

    const availableYears = useMemo(() => [...new Set(userCerts.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a), [userCerts]);
    const [selectedYear, setSelectedYear] = useState<number | null>(availableYears.length > 0 ? availableYears[0] : null);

    useEffect(() => {
        if (selectedYear === null && availableYears.length > 0) {
            setSelectedYear(availableYears[0]);
        } else if (selectedYear !== null && !availableYears.includes(selectedYear)) {
            setSelectedYear(availableYears.length > 0 ? availableYears[0] : null);
        }
    }, [availableYears, selectedYear]);

    const certsForYear = useMemo(() => selectedYear ? userCerts.filter(c => new Date(c.date).getFullYear() === selectedYear) : [], [userCerts, selectedYear]);
    const totalCreditsForYear = useMemo(() => certsForYear.reduce((sum, cert) => sum + Number(cert.credits || 0), 0), [certsForYear]);

    return (
        <>
        <div className="report-viewer-modal-overlay" onClick={onClose}>
            <div className="report-viewer-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="report-viewer-modal-header">
                    <h3>Chi tiết chứng chỉ của {user.name}</h3>
                     <div>
                        <button className="btn btn-secondary" style={{marginRight: '10px'}} onClick={() => setIsShareModalOpen(true)}>
                            <span className="material-icons" style={{fontSize: '20px'}}>qr_code_2</span> Tạo QR chia sẻ
                        </button>
                        <button className="close-btn" onClick={onClose}>&times;</button>
                    </div>
                </div>
                <div className="report-viewer-modal-body">
                    <div className="modal-summary">
                        <p>
                            <span>Tổng cộng:</span> 
                            <strong>{allTimeTotals.count}</strong> chứng chỉ, 
                            <strong> {allTimeTotals.credits}</strong> tiết
                        </p>
                    </div>

                    <div className="year-selector">
                        <label htmlFor="cert-year">Lọc theo năm:</label>
                        <select id="cert-year" value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value ? Number(e.target.value) : null)}>
                             <option value="">-- Tất cả các năm --</option>
                             {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                        <div className="credits-summary">
                            <span>Tổng tiết năm {selectedYear || ''}:</span>
                            <strong>{Number.isInteger(totalCreditsForYear) ? totalCreditsForYear : totalCreditsForYear.toFixed(1)}</strong>
                        </div>
                    </div>

                    <div className="details-table-container">
                        <table className="details-table">
                             <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Tên chứng chỉ</th>
                                    <th>Số tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                                {certsForYear.length > 0 ? (
                                    certsForYear.map((cert, index) => (
                                        <tr key={cert.id}>
                                            <td data-label="STT">{index + 1}</td>
                                            <td data-label="Tên chứng chỉ">{cert.name}</td>
                                            <td data-label="Số tiết">{cert.credits}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} style={{textAlign: 'center'}}>Không có chứng chỉ nào trong năm {selectedYear || ''}. Chọn năm khác để xem.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        {isShareModalOpen && <ShareModal user={user} onClose={() => setIsShareModalOpen(false)} api={api} />}
        </>
    );
};

export function ReportViewer({ id, allUsers, allCertificates }: { id: string, allUsers: ReportUser[], allCertificates: Certificate[] }) {
    const [viewingUser, setViewingUser] = useState<ReportUser | null>(null);
    const [error, setError] = useState('');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    useEffect(() => {
        if (allUsers.length > 0) {
            const userToShow = allUsers.find(u => String(u.id) === id);
            if (userToShow) {
                setViewingUser(userToShow);
                const userCerts = allCertificates.filter(c => c.userId === userToShow.id);
                const availableYears = [...new Set(userCerts.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a);
                if (availableYears.length > 0) {
                    setSelectedYear(availableYears[0]);
                }
            } else {
                setError(`Không tìm thấy người dùng với ID: ${id}`);
            }
        }
    }, [id, allUsers, allCertificates]);

    if (!viewingUser && !error) return (
        <div className="report-page-container">
            <h2>Đang tải...</h2>
        </div>
    );

    if (error) return (
        <div className="report-page-container">
            <h2 className="error">{error}</h2>
        </div>
    );
    
    if (!viewingUser) return null;

    // Calculate all-time totals
    const userCerts = allCertificates.filter(c => c.userId === viewingUser.id);
    const allTimeTotals = {
        count: userCerts.length,
        credits: userCerts.reduce((sum, cert) => sum + Number(cert.credits || 0), 0)
    };
    const formattedAllTimeCredits = Number.isInteger(allTimeTotals.credits) ? allTimeTotals.credits : allTimeTotals.credits.toFixed(1);

    const availableYears = [...new Set(userCerts.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a);
    const certsForYear = selectedYear ? userCerts.filter(c => new Date(c.date).getFullYear() === selectedYear) : [];
    const totalCreditsForYear = certsForYear.reduce((sum, cert) => sum + Number(cert.credits || 0), 0);
    
    return (
        <div className="report-page-container report-viewer-standalone">
            <div className="report-viewer-header">
                <h2>Báo cáo Kết quả Đào tạo Liên tục</h2>
                <p><strong>Nhân viên:</strong> {viewingUser.name}</p>
                <p><strong>Khoa/Phòng:</strong> {viewingUser.department}</p>
            </div>

            <div className="report-viewer-summary-standalone">
                <div className="summary-item">
                    <span className="label">Tổng số chứng chỉ</span>
                    <span className="value">{allTimeTotals.count}</span>
                </div>
                <div className="summary-item">
                    <span className="label">Tổng số tiết (Tất cả năm)</span>
                    <span className="value">{formattedAllTimeCredits}</span>
                </div>
            </div>

            <div className="report-details-section">
                <div className="year-selector">
                    <label htmlFor="cert-year">Xem chi tiết theo năm:</label>
                    <select id="cert-year" value={selectedYear || ''} onChange={e => setSelectedYear(Number(e.target.value))}>
                         {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <div className="credits-summary">
                        <span>Tổng tiết năm {selectedYear}:</span>
                        <strong>{Number.isInteger(totalCreditsForYear) ? totalCreditsForYear : totalCreditsForYear.toFixed(1)}</strong>
                    </div>
                </div>

                <div className="details-table-container">
                    <table className="details-table">
                         <thead>
                            <tr>
                                <th>STT</th>
                                <th>Tên chứng chỉ</th>
                                <th>Số tiết</th>
                            </tr>
                        </thead>
                        <tbody>
                            {certsForYear.length > 0 ? (
                                certsForYear.map((cert, index) => (
                                    <tr key={cert.id}>
                                        <td data-label="STT">{index + 1}</td>
                                        <td data-label="Tên chứng chỉ">{cert.name}</td>
                                        <td data-label="Số tiết">{cert.credits}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} style={{textAlign: 'center'}}>Không có chứng chỉ nào trong năm {selectedYear || ''}.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}