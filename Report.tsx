import React, { useState, useEffect, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";

// NOTE: This helper object is copied from index.tsx to make this component self-contained.
// In a larger application, this would be in a shared utility file.
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzSh3oyhzNh-NGm2lGxoP0CqMJjpsV9FZYlt443T0XDf91GsdUfSAU68P-OlEuJo6xtJw/exec'; 

const api = {
    request: async (method: 'GET' | 'POST', action?: string, payload?: any) => {
        if (!BACKEND_URL) {
            alert('Lỗi cấu hình: Vui lòng dán URL của Google Apps Script Web App vào biến BACKEND_URL.');
            throw new Error("Backend URL not configured.");
        }

        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            redirect: 'follow',
        };

        if (method === 'POST') {
            options.body = JSON.stringify({ action, payload });
        }
        
        try {
            // For GET, the action is passed as a query parameter. The backend's doGet handles 'fetchInitialData' by default.
            const url = method === 'GET' ? `${BACKEND_URL}?action=fetchInitialData` : BACKEND_URL;
            const response = await fetch(url, options);
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
};

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
  image: string;
  imageId: string;
  updatedAt?: string;
  imageOrientation?: number;
}


// --- Data Sanitization Helpers (Copied from index.tsx) ---

const findProp = (obj: any, propNames: string[]) => {
    if (!obj) return undefined;
    for (const name of propNames) {
        if (obj[name] !== undefined && obj[name] !== null && obj[name] !== '') {
            return obj[name];
        }
    }
    return undefined;
};

const parseDateToISO = (dateString: string): string => {
    if (!dateString || typeof dateString !== 'string') return '';
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) {
        try {
            return d.toLocaleDateString('en-CA');
        } catch(e) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }
    const parts = dateString.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (parts) {
        const day = parts[1].padStart(2, '0');
        const month = parts[2].padStart(2, '0');
        const year = parts[3];
        return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    return dateString;
};

const extractGoogleDriveId = (urlOrId: string): string => {
    if (!urlOrId) return '';
    if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId)) {
        return urlOrId;
    }
    const match = urlOrId.match(/[-\w]{25,}/);
    return match ? match[0] : '';
};

const sanitizeUser = (rawUser: any): ReportUser | null => {
    if (!rawUser) return null;
    const id = findProp(rawUser, ['id', 'ID']);
    const username = findProp(rawUser, ['username', 'Username']);
    if (id === undefined || username === undefined) return null;
    const parsedId = parseInt(String(id), 10);
    if (isNaN(parsedId) || parsedId <= 0) return null;
    
    return {
        id: parsedId,
        name: String(findProp(rawUser, ['name', 'Name']) || ''),
        department: String(findProp(rawUser, ['department', 'Department']) || ''),
        role: String(findProp(rawUser, ['role', 'Role']) || 'user').toLowerCase().trim(),
        isSuspended: String(findProp(rawUser, ['trạngthái', 'trangthai', 'isSuspended']) || '').trim() === 'Tạm ngừng',
    };
};

const sanitizeCertificate = (rawCert: any): Certificate | null => {
    if (!rawCert) return null;
    const id = findProp(rawCert, ['id', 'ID']);
    const userId = findProp(rawCert, ['userId', 'UserId', 'userid']);
    if (id === undefined || userId === undefined) return null;

    const parsedId = parseInt(String(id).replace(/\D/g, ''), 10);
    const parsedUserId = parseInt(String(userId).replace(/\D/g, ''), 10);
    if (isNaN(parsedId) || isNaN(parsedUserId) || parsedId <= 0 || parsedUserId <= 0) return null;

    const creditsRaw = String(findProp(rawCert, ['credits', 'Credits']) || '0').replace(',', '.');
    const creditsParsed = parseFloat(creditsRaw);
    const imageUrlOrId = findProp(rawCert, ['image', 'Image', 'imageUrl']);
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
// --- End of Sanitization Helpers ---


const Navigation = () => (
    <nav className="main-nav">
        <a href="?view=personal_info">Trang chính</a>
        <a href="?view=report">Danh sách NV</a>
    </nav>
);

export function Report() {
  const [allUsers, setAllUsers] = useState<ReportUser[]>([]);
  const [allCertificates, setAllCertificates] = useState<Certificate[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [viewingUser, setViewingUser] = useState<ReportUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError("");
      try {
        const [initialData, certData] = await Promise.all([
          api.request("GET", "fetchInitialData"),
          api.request("POST", "fetchCertificates", {})
        ]);
        
        const sanitizedUsers = (initialData.users || []).map(sanitizeUser).filter((u): u is ReportUser => u !== null);
        const sanitizedCerts = (certData || []).map(sanitizeCertificate).filter((c): c is Certificate => c !== null);

        const reportUsers = sanitizedUsers.filter((u: ReportUser) => 
            u.role !== 'admin' && u.role !== 'reporter' && !u.isSuspended
        );

        setAllUsers(reportUsers);
        setAllCertificates(sanitizedCerts);

      } catch (err: any) {
        setError(`Lỗi tải dữ liệu: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(allUsers.map(u => u.department));
    return ["all", ...Array.from(depts).sort()];
  }, [allUsers]);
  
  const filteredUsers = useMemo(() => {
    if (filterDepartment === "all") return allUsers;
    return allUsers.filter(u => u.department === filterDepartment);
  }, [allUsers, filterDepartment]);

  return (
    <>
      <Navigation />
      <div className="report-page-container">
        <h2>Danh sách nhân viên</h2>
        
        <div className="report-filters">
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

        {isLoading ? (
            <p>Đang tải danh sách nhân viên...</p>
        ) : error ? (
            <div className="user-selection-table-container">
                <p className="error" style={{textAlign: 'center', padding: '20px'}}>{error}</p>
             </div>
        ) : (
            <div className="report-viewer-table-container">
                <table className="report-viewer-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Họ và Tên</th>
                            <th>Khoa/Phòng</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user, index) => (
                            <tr key={user.id}>
                                <td data-label="STT">{index + 1}</td>
                                <td data-label="Họ và Tên">{user.name}</td>
                                <td data-label="Khoa/Phòng">{user.department}</td>
                                <td data-label="Hành động">
                                    <button className="btn-view" onClick={() => setViewingUser(user)}>Xem</button>
                                </td>
                            </tr>
                        ))}
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
        />
      )}
    </>
  );
}


const UserDetailsModal = ({ user, allCertificates, onClose }: { user: ReportUser, allCertificates: Certificate[], onClose: () => void }) => {
    const userCerts = useMemo(() => allCertificates.filter(c => c.userId === user.id), [allCertificates, user.id]);
    const availableYears = useMemo(() => [...new Set(userCerts.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a), [userCerts]);
    const [selectedYear, setSelectedYear] = useState<number | null>(availableYears.length > 0 ? availableYears[0] : null);

    useEffect(() => {
        // If the selected year is no longer available (e.g. data changed), reset to the latest available year
        if (selectedYear === null && availableYears.length > 0) {
            setSelectedYear(availableYears[0]);
        }
    }, [availableYears, selectedYear]);

    const certsForYear = useMemo(() => selectedYear ? userCerts.filter(c => new Date(c.date).getFullYear() === selectedYear) : [], [userCerts, selectedYear]);
    const totalCreditsForYear = useMemo(() => certsForYear.reduce((sum, cert) => sum + Number(cert.credits || 0), 0), [certsForYear]);

    return (
        <div className="report-viewer-modal-overlay" onClick={onClose}>
            <div className="report-viewer-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="report-viewer-modal-header">
                    <h3>Chi tiết chứng chỉ của {user.name}</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="report-viewer-modal-body">
                    <div className="year-selector">
                        <label htmlFor="cert-year">Chọn năm:</label>
                        <select id="cert-year" value={selectedYear || ''} onChange={e => setSelectedYear(Number(e.target.value))}>
                             {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                        <div className="credits-summary">
                            <span>Tổng tiết:</span>
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
        </div>
    );
};


export function ReportViewer({ id }: { id: string }) {
    const [report, setReport] = useState<{title: string, content: string} | null>(null);
    const [reportUsers, setReportUsers] = useState<ReportUser[]>([]);
    const [allCertificates, setAllCertificates] = useState<Certificate[]>([]);
    const [viewingUser, setViewingUser] = useState<ReportUser | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReportAndCerts = async () => {
            if (!id) {
                setError('Không có ID báo cáo.');
                setIsLoading(false);
                return;
            };
            setIsLoading(true);
            try {
                const [reportData, certData] = await Promise.all([
                    api.request('POST', 'getReport', { id }),
                    api.request('POST', 'fetchCertificates', {})
                ]);

                setReport(reportData);
                const sanitizedCerts = (certData || []).map(sanitizeCertificate).filter((c): c is Certificate => c !== null);
                setAllCertificates(sanitizedCerts);

                if (reportData.content) {
                    const parsedUsers = JSON.parse(reportData.content);
                    if (Array.isArray(parsedUsers)) {
                        const sanitizedReportUsers = parsedUsers.map(sanitizeUser).filter((u): u is ReportUser => u !== null);
                        setReportUsers(sanitizedReportUsers);
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Không thể tải báo cáo hoặc danh sách chứng chỉ.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchReportAndCerts();
    }, [id]);

    const renderContent = () => {
        if (isLoading) return <p>Đang tải báo cáo...</p>;
        if (error) return <p className="error">Lỗi: {error}</p>;
        if (!report) return <p>Không tìm thấy báo cáo.</p>;

        return (
            <div>
                <h1>{report.title}</h1>
                <div className="report-viewer-table-container">
                    <table className="report-viewer-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Họ và Tên</th>
                                <th>Khoa/Phòng</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportUsers.map((user, index) => (
                                <tr key={user.id}>
                                    <td data-label="STT">{index + 1}</td>
                                    <td data-label="Họ và Tên">{user.name}</td>
                                    <td data-label="Khoa/Phòng">{user.department}</td>
                                    <td data-label="Hành động">
                                        <button className="btn-view" onClick={() => setViewingUser(user)}>Xem</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <>
            <Navigation />
            <div className="report-page-container">
                {renderContent()}
            </div>
            {viewingUser && (
                <UserDetailsModal 
                    user={viewingUser}
                    allCertificates={allCertificates}
                    onClose={() => setViewingUser(null)}
                />
            )}
        </>
    );
}