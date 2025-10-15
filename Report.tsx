import React, { useState, useEffect, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";

// NOTE: This helper object is copied from index.tsx to make this component self-contained.
// In a larger application, this would be in a shared utility file.
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzSh3oyhzNh-NGm2lGxoP0CqMJjpsV9FZYlt443T0XDf91GsdUfSAU68P-OlEuJo6xtJw/exec'; 

const api = {
    request: async (method: 'POST', action?: string, payload?: any) => {
        if (!BACKEND_URL) {
            alert('Lỗi cấu hình: Vui lòng dán URL của Google Apps Script Web App vào biến BACKEND_URL.');
            throw new Error("Backend URL not configured.");
        }

        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            body: JSON.stringify({ action, payload }),
        };
        
        try {
            const response = await fetch(BACKEND_URL, options);
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
}

const Navigation = () => (
    <nav className="main-nav">
        <a href="?view=personal_info">Trang chính</a>
        <a href="?view=report">Tạo Báo cáo</a>
    </nav>
);

export function Report() {
  const [title, setTitle] = useState("");
  const [allUsers, setAllUsers] = useState<ReportUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [shareLink, setShareLink] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      setIsLoading(true);
      try {
        const usersForReport = await api.request("POST", "getUsersForReport");
        setAllUsers(usersForReport);
      } catch (err: any) {
        setError(`Lỗi tải danh sách nhân viên: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(allUsers.map(u => u.department));
    return ["all", ...Array.from(depts).sort()];
  }, [allUsers]);
  
  const filteredUsers = useMemo(() => {
    if (filterDepartment === "all") return allUsers;
    return allUsers.filter(u => u.department === filterDepartment);
  }, [allUsers, filterDepartment]);
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedUserIds(filteredUsers.map(u => u.id));
    } else {
        setSelectedUserIds([]);
    }
  };

  const handleSelectUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  async function createReport() {
    if (!title.trim()) {
        setError("Tiêu đề báo cáo không được để trống.");
        return;
    }
    if (selectedUserIds.length === 0) {
        setError("Vui lòng chọn ít nhất một nhân viên để tạo báo cáo.");
        return;
    }
    setError("");
    setIsCreating(true);
    try {
        const selectedUsers = allUsers.filter(u => selectedUserIds.includes(u.id));
        const content = JSON.stringify(selectedUsers);

        const data = await api.request("POST", "createReport", { title, content });
        if (data && data.id) {
            const link = `${window.location.origin}${window.location.pathname}?view=report-viewer&id=${data.id}`;
            setShareLink(link);
            setTitle("");
            setSelectedUserIds([]);
        }
    } catch (err: any) {
        console.error("Failed to create report:", err);
        setError(`Lỗi: ${err.message || 'Không thể tạo báo cáo.'}`);
    } finally {
        setIsCreating(false);
    }
  }

  return (
    <>
      <Navigation />
      <div className="report-page-container">
        <h2>Tạo báo cáo theo danh sách nhân viên</h2>
        <div className="form-group">
            <label htmlFor="report-title">Tiêu đề báo cáo</label>
            <input
                id="report-title"
                placeholder="Ví dụ: Báo cáo tập huấn quý 3/2024"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
            />
        </div>

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
        ) : (
            <div className="user-selection-table-container">
                <table className="user-selection-table">
                    <thead>
                        <tr>
                            <th>
                                <input 
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                                    title="Chọn/Bỏ chọn tất cả"
                                />
                            </th>
                            <th>STT</th>
                            <th>Họ và Tên</th>
                            <th>Khoa/Phòng</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user, index) => (
                            <tr key={user.id}>
                                <td>
                                    <input 
                                        type="checkbox"
                                        checked={selectedUserIds.includes(user.id)}
                                        onChange={() => handleSelectUser(user.id)}
                                    />
                                </td>
                                <td>{index + 1}</td>
                                <td>{user.name}</td>
                                <td>{user.department}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {error && <p className="error" style={{textAlign: 'left', margin: '10px 0'}}>{error}</p>}
        <div className="report-creation-actions">
            <span>Đã chọn: {selectedUserIds.length} nhân viên</span>
            <button className="btn btn-primary" onClick={createReport} disabled={isLoading || isCreating}>
                {isCreating ? 'Đang tạo...' : 'Tạo báo cáo'}
            </button>
        </div>

        {shareLink && (
            <div className="share-link-container">
                <h4>Tạo thành công!</h4>
                <p>Link xem báo cáo: <a href={shareLink} target="_blank" rel="noopener noreferrer">{shareLink}</a></p>
                <div style={{marginTop: '10px'}}>
                    <QRCodeCanvas value={shareLink} size={180} />
                </div>
            </div>
        )}
      </div>
    </>
  );
}

export function ReportViewer({ id }: { id: string }) {
    const [report, setReport] = useState<{title: string, content: string} | null>(null);
    const [reportUsers, setReportUsers] = useState<ReportUser[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            if (!id) {
                setError('Không có ID báo cáo.');
                setIsLoading(false);
                return;
            };
            setIsLoading(true);
            try {
                const data = await api.request('POST', 'getReport', { id });
                setReport(data);
                // Parse content to get users
                if (data.content) {
                    const parsedUsers = JSON.parse(data.content);
                    if (Array.isArray(parsedUsers)) {
                        setReportUsers(parsedUsers);
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Không thể tải báo cáo.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchReport();
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
                                    <td>{index + 1}</td>
                                    <td>{user.name}</td>
                                    <td>{user.department}</td>
                                    <td><button className="btn-view" onClick={() => alert(`Xem chi tiết cho: ${user.name}`)}>Xem</button></td>
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
        </>
    );
}