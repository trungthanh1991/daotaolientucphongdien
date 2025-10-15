import React, { useState, useEffect, useMemo, useRef } from "react";

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

// Helper function to normalize text for searching (remove accents, lowercase)
const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

export function Report({ allUsers, allCertificates }: { allUsers: ReportUser[], allCertificates: Certificate[] }) {
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
        />
      )}
    </>
  );
}


const UserDetailsModal = ({ user, allCertificates, onClose }: { user: ReportUser, allCertificates: Certificate[], onClose: () => void }) => {
    const userCerts = useMemo(() => allCertificates.filter(c => c.userId === user.id), [allCertificates, user.id]);
    
    const allTimeTotals = useMemo(() => {
        const totalCredits = userCerts.reduce((sum, cert) => sum + Number(cert.credits || 0), 0);
        return {
            count: userCerts.length,
            credits: Number.isInteger(totalCredits) ? totalCredits : totalCredits.toFixed(1)
        };
    }, [userCerts]);

    const availableYears = useMemo(() => [...new Set(userCerts.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a), [userCerts]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    useEffect(() => {
        // When the component mounts or availableYears changes for a new user,
        // set the default selection to the latest year.
        // This allows the user to change the selection afterwards without being overridden.
        if (availableYears.length > 0) {
            setSelectedYear(availableYears[0]);
        } else {
            setSelectedYear(null);
        }
    }, [availableYears]);

    const certsForYear = useMemo(() => selectedYear ? userCerts.filter(c => new Date(c.date).getFullYear() === selectedYear) : userCerts, [userCerts, selectedYear]);
    const totalCreditsForYear = useMemo(() => certsForYear.reduce((sum, cert) => sum + Number(cert.credits || 0), 0), [certsForYear]);

    return (
        <>
        <div className="report-viewer-modal-overlay" onClick={onClose}>
            <div className="report-viewer-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="report-viewer-modal-header">
                    <h3>Chi tiết chứng chỉ của {user.name}</h3>
                     <div>
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
                            <span>{selectedYear ? `Tổng tiết năm ${selectedYear}:` : 'Tổng số tiết (tất cả các năm):'}</span>
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
                                {certsForYear.length > 0 ? certsForYear.map((cert, index) => (
                                    <tr key={cert.id}>
                                        <td>{index + 1}</td>
                                        <td>{cert.name}</td>
                                        <td>{cert.credits}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3}>Không có chứng chỉ nào cho năm đã chọn.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export function ReportViewer({ id, allUsers, allCertificates }: { id: string, allUsers: ReportUser[], allCertificates: Certificate[] }) {
    const user = useMemo(() => allUsers.find(u => String(u.id) === id), [allUsers, id]);

    const userCerts = useMemo(() => {
        if (!user) return [];
        return allCertificates.filter(c => c.userId === user.id);
    }, [allCertificates, user]);

    const allTimeTotals = useMemo(() => {
        const totalCredits = userCerts.reduce((sum, cert) => sum + Number(cert.credits || 0), 0);
        return {
            count: userCerts.length,
            credits: Number.isInteger(totalCredits) ? totalCredits : totalCredits.toFixed(1)
        };
    }, [userCerts]);

    const availableYears = useMemo(() => [...new Set(userCerts.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a), [userCerts]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null); // Default to all years

    const certsForYear = useMemo(() => selectedYear ? userCerts.filter(c => new Date(c.date).getFullYear() === selectedYear) : userCerts, [userCerts, selectedYear]);
    const totalCreditsForYear = useMemo(() => certsForYear.reduce((sum, cert) => sum + Number(cert.credits || 0), 0), [certsForYear]);

    if (allUsers.length > 0 && !user) {
        return (
            <div className="report-page-container">
                 <div className="report-viewer-header">
                    <h1>Không tìm thấy nhân viên</h1>
                 </div>
                 <p>Liên kết này có thể đã cũ hoặc không hợp lệ. Vui lòng kiểm tra lại.</p>
            </div>
        );
    }
    
    if (!user) {
         return (
            <div className="report-page-container">
                <p>Đang tải dữ liệu...</p>
            </div>
        );
    }

    return (
        <div className="report-page-container">
            <div className="report-viewer-header">
                <h1>Hồ sơ đào tạo liên tục</h1>
                <h2>{user.name}</h2>
                <p>{user.department}</p>
            </div>

            <div className="report-viewer-content">
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
                        <span>{selectedYear ? `Tổng tiết năm ${selectedYear}:` : 'Tổng số tiết (tất cả các năm):'}</span>
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
                            {certsForYear.length > 0 ? certsForYear.map((cert, index) => (
                                <tr key={cert.id}>
                                    <td data-label="STT">{index + 1}</td>
                                    <td data-label="Tên chứng chỉ">{cert.name}</td>
                                    <td data-label="Số tiết">{cert.credits}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={3}>Không có chứng chỉ nào được tìm thấy.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}