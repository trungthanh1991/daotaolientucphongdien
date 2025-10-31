import React, { useState, useMemo, ReactNode, useRef, useEffect } from 'react';
import { UserData, Certificate, Department, Title, AppSettings } from '../App';
import PrintIcon from '../components/icons/PrintIcon';
import ExportIcon from '../components/icons/ExportIcon';
import ShareIcon from '../components/icons/ShareIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ShareReportModal from '../components/ShareReportModal';
import CertificateDetailModal from '../components/CertificateDetailModal';
import { db } from '../firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import WordIcon from '../components/icons/WordIcon';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';


interface ComplianceReportRow {
    id: string;
    name: string;
    title: string;
    totalCredits: number;
    requirement: number;
    status: 'Đã đạt' | 'Chưa đạt';
}

interface SummaryReportRow {
    id: string;
    name: string;
    title: string;
    department: string;
    totalCredits: number;
    departmentId?: string;
    titleId?: string;
}

interface DetailedReportRow {
    id: string;
    name: string;
    certificates: { name: string; credits: number }[];
    totalCredits: number;
}

interface SummaryWithDetailsRow {
    id: string;
    name: string;
    totalCredits: number;
    certificates: { name: string, credits: number }[];
}


type ReportRow = ComplianceReportRow | SummaryReportRow | DetailedReportRow | SummaryWithDetailsRow;
type SortableKeys = string;

interface ReportingProps {
    user: UserData;
    users: UserData[];
    certificates: Certificate[];
    departments: Department[];
    titles: Title[];
    settings: AppSettings | null;
    geminiApiKey: string | null;
}

const Reporting: React.FC<ReportingProps> = ({ user, users, certificates, departments, titles, settings, geminiApiKey }) => {
    const [reportType, setReportType] = useState('');
    const [filterMode, setFilterMode] = useState<'year' | 'all' | 'range'>('year');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedTitle, setSelectedTitle] = useState('all');

    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<ReportRow[] | null>(null);
    const [reportHeaders, setReportHeaders] = useState<Record<string, string>>({});
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>(null);
    const [shareModalInfo, setShareModalInfo] = useState<{ url: string; expiresAt: Date; token: string; } | null>(null);
    const [detailModalUser, setDetailModalUser] = useState<SummaryWithDetailsRow | null>(null);

    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);


    const titleMap = useMemo(() => new Map(titles.map(t => [t.id, t.name])), [titles]);
    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

    const yearOptions = useMemo(() => {
        const years = new Set(certificates.map(c => c.date.toDate().getFullYear()));
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a).map(String);
    }, [certificates]);
    
    const reportOptions = [
        { value: '', label: 'Chọn loại báo cáo...' },
        { value: 'compliance', label: 'Báo cáo tuân thủ theo chu kỳ' },
        { value: 'summary_with_details', label: 'Báo cáo Tổng hợp có Chi tiết' },
        { value: 'summary', label: 'Báo cáo tổng hợp toàn bộ' },
        { value: 'detail', label: 'Báo cáo chi tiết chứng chỉ' },
        { value: 'department', label: 'Báo cáo tổng hợp theo Khoa/Phòng' },
        { value: 'title_detail', label: 'Báo cáo tổng hợp theo Chức danh' },
    ];
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGenerateReport = () => {
        setIsGenerating(true);
        setReportData(null);
        setReportHeaders({});
        setSortConfig(null);
        setAiSummary(null);
        setSummaryError(null);

        setTimeout(() => { // Simulate processing delay
            const validRoles: UserData['role'][] = ['user', 'reporter_user'];
            const relevantUsers = users.filter(user => validRoles.includes(user.role) && user.status !== 'disabled');
            
            const filteredCertsByTime = certificates.filter(cert => {
                const certDate = cert.date.toDate();
                if (filterMode === 'all') return true;
                if (filterMode === 'year') return certDate.getFullYear().toString() === selectedYear;
                if (filterMode === 'range') {
                    if (!startDate || !endDate) return false;
                    const start = new Date(startDate);
                    start.setUTCHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setUTCHours(23, 59, 59, 999);
                    return certDate >= start && certDate <= end;
                }
                return false;
            });

            switch(reportType) {
                case 'compliance': {
                    if (!settings) {
                        alert("Vui lòng cấu hình chu kỳ tuân thủ trong trang Quản trị.");
                        setIsGenerating(false);
                        return;
                    }
                    setReportHeaders({
                        name: 'Họ và tên',
                        title: 'Chức danh',
                        totalCredits: 'Tổng số tiết',
                        requirement: 'Yêu cầu',
                        status: 'Trạng thái',
                    });

                    const userCreditsMap = new Map<string, number>();
                    certificates.forEach(cert => {
                        const certYear = cert.date.toDate().getFullYear();
                        if (settings && certYear >= settings.complianceStartYear && certYear <= settings.complianceEndYear) {
                            userCreditsMap.set(cert.userId, (userCreditsMap.get(cert.userId) ?? 0) + Number(cert.credits));
                        }
                    });

                    const reportResult: ComplianceReportRow[] = relevantUsers.map(user => {
                        const totalCredits = userCreditsMap.get(user.id) || 0;
                        const isPharmacist = user.titleId === '4';
                        const requirement = isPharmacist ? 8 : 120;
                        return {
                            id: user.id,
                            name: user.name,
                            title: titleMap.get(user.titleId) || 'Chưa có',
                            totalCredits,
                            requirement,
                            status: totalCredits >= requirement ? 'Đã đạt' : 'Chưa đạt',
                        };
                    });
                    setReportData(reportResult);
                    break;
                }
                
                case 'summary_with_details': {
                    setReportHeaders({
                        name: 'Họ và tên',
                        totalCredits: 'Tổng số tiết',
                        actions: 'Hành động',
                    });
                    const userCertMap = new Map<string, { certificates: { name: string; credits: number }[], totalCredits: number }>();
                    filteredCertsByTime.forEach(cert => {
                        if (!userCertMap.has(cert.userId)) {
                            userCertMap.set(cert.userId, { certificates: [], totalCredits: 0 });
                        }
                        const entry = userCertMap.get(cert.userId)!;
                        entry.certificates.push({ name: cert.name, credits: cert.credits });
                        // FIX: The left-hand side and right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
                        entry.totalCredits += Number(cert.credits);
                    });

                    const reportResult: SummaryWithDetailsRow[] = relevantUsers.map(user => {
                        const userData = userCertMap.get(user.id) || { certificates: [], totalCredits: 0 };
                        return {
                            id: user.id,
                            name: user.name,
                            totalCredits: userData.totalCredits,
                            certificates: userData.certificates.sort((a,b) => a.name.localeCompare(b.name, 'vi')),
                        };
                    });
                    setReportData(reportResult);
                    break;
                }

                case 'summary':
                case 'detail':
                case 'department':
                case 'title_detail': {
                    const userCreditsMap = new Map<string, number>();
                    filteredCertsByTime.forEach(cert => {
                        userCreditsMap.set(cert.userId, Number(userCreditsMap.get(cert.userId) ?? 0) + Number(cert.credits));
                    });

                    if (reportType === 'summary') {
                        setReportHeaders({ name: 'Họ và tên', title: 'Chức danh', department: 'Khoa/Phòng', totalCredits: 'Tổng số tiết' });
                        const reportResult: SummaryReportRow[] = relevantUsers.map(user => ({
                            id: user.id, name: user.name, title: titleMap.get(user.titleId) || 'Chưa có',
                            department: departmentMap.get(user.departmentId) || 'Chưa có', totalCredits: userCreditsMap.get(user.id) || 0,
                        }));
                        setReportData(reportResult);
                    } else if (reportType === 'detail') {
                        setReportHeaders({ certName: 'Tên chứng chỉ', credits: 'Số tiết' }); // Headers are now part of the table render
                        const userCertMap = new Map<string, { certificates: { name: string; credits: number }[], totalCredits: number }>();
                        filteredCertsByTime.forEach(cert => {
                            if (!userCertMap.has(cert.userId)) userCertMap.set(cert.userId, { certificates: [], totalCredits: 0 });
                            const entry = userCertMap.get(cert.userId)!;
                            entry.certificates.push({ name: cert.name, credits: cert.credits });
                            entry.totalCredits = entry.totalCredits + Number(cert.credits);
                        });
                        const reportResult: DetailedReportRow[] = Array.from(userCertMap.entries()).map(([userId, data]) => ({
                            id: userId, name: userMap.get(userId)?.name || 'Không rõ', ...data
                        })).filter(u => u.certificates.length > 0);
                        setReportData(reportResult);
                    } else if (reportType === 'department') {
                        setReportHeaders({ name: 'Họ tên', totalCredits: 'Tổng số tiết' });
                        let filteredUsers = relevantUsers;
                        if (selectedDepartment !== 'all') {
                            filteredUsers = relevantUsers.filter(u => u.departmentId === selectedDepartment);
                        }
                        const reportResult: SummaryReportRow[] = filteredUsers.map(user => ({
                            id: user.id, name: user.name, title: titleMap.get(user.titleId) || 'Chưa có',
                            department: departmentMap.get(user.departmentId) || 'Chưa có', totalCredits: userCreditsMap.get(user.id) || 0,
                            departmentId: user.departmentId,
                        })).sort((a, b) => a.department.localeCompare(b.department, 'vi') || a.name.localeCompare(b.name, 'vi'));
                        setReportData(reportResult);
                    } else if (reportType === 'title_detail') {
                        setReportHeaders({ name: 'Họ tên', totalCredits: 'Tổng số tiết' });
                        let filteredUsers = relevantUsers;
                        if (selectedTitle !== 'all') {
                            filteredUsers = relevantUsers.filter(u => u.titleId === selectedTitle);
                        }
                        const reportResult: SummaryReportRow[] = filteredUsers.map(user => ({
                            id: user.id, name: user.name, title: titleMap.get(user.titleId) || 'Chưa có',
                            department: departmentMap.get(user.departmentId) || 'Chưa có', totalCredits: userCreditsMap.get(user.id) || 0,
                            titleId: user.titleId,
                        })).sort((a, b) => a.title.localeCompare(b.title, 'vi') || a.name.localeCompare(b.name, 'vi'));
                        setReportData(reportResult);
                    }
                    break;
                }
                default:
                    alert('Chức năng báo cáo này đang được phát triển.');
            }
            setIsGenerating(false);
        }, 500);
    };

    const sortedReportData = useMemo(() => {
        if (!reportData) return null;
        let sortableItems = [...reportData];
        if (sortConfig !== null && !['department', 'title_detail', 'detail'].includes(reportType)) {
             sortableItems.sort((a, b) => {
                const aValue = (a as any)[sortConfig.key];
                const bValue = (b as any)[sortConfig.key];
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    if (sortConfig.key === 'actions') return 0; // Don't sort by action column
                    return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue, 'vi') : bValue.localeCompare(aValue, 'vi');
                }
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                     return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [reportData, sortConfig, reportType]);

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key || ['department', 'title_detail', 'detail', 'actions'].includes(key) || ['summary_with_details', 'department', 'title_detail', 'detail'].includes(reportType)) return '';
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };
    
    const handlePrint = () => { window.print(); };

    const handleShareReport = async () => {
        if (!sortedReportData) return;

        const reportTitleOptions: { [key: string]: string } = {
            compliance: 'Báo cáo Tuân thủ theo Chu kỳ',
            summary: 'Báo cáo Tổng hợp Toàn bộ',
            detail: 'Báo cáo Chi tiết Chứng chỉ',
            department: 'Báo cáo Tổng hợp theo Khoa/Phòng',
            title_detail: 'Báo cáo Tổng hợp theo Chức danh',
            summary_with_details: 'Báo cáo Tổng hợp có Chi tiết',
        };

        const reportTitle = reportTitleOptions[reportType] || 'Báo cáo Tùy chỉnh';
        const token = Math.random().toString(36).substring(2, 12);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

        const sharePayload = {
            reportTitle,
            reportType,
            reportHeaders: JSON.stringify(reportHeaders),
            reportData: JSON.stringify(sortedReportData),
            createdAt: Timestamp.fromDate(now),
            expiresAt: Timestamp.fromDate(expiresAt),
            createdBy: user.name,
            token: token,
        };

        try {
            const docRef = await addDoc(collection(db, 'SharedReports'), sharePayload);
            const shareUrl = `${window.location.origin}/?id=${docRef.id}`;
            setShareModalInfo({ url: shareUrl, expiresAt, token });
        } catch (error) {
            console.error("Error creating share link:", error);
            alert("Đã xảy ra lỗi khi tạo liên kết chia sẻ. Vui lòng thử lại.");
        }
    };


    const handleExportExcel = () => {
        if (!sortedReportData) return;
        let csvContent: string;

        if (reportType === 'detail' || reportType === 'summary_with_details') {
            const headers = ['STT', 'Họ tên', 'Tên chứng chỉ', 'Số tiết', 'Tổng tiết'];
            const rows: string[] = [];
            let stt = 1;
            (sortedReportData as (DetailedReportRow | SummaryWithDetailsRow)[]).forEach(userRow => {
                if (userRow.certificates.length > 0) {
                    const firstCert = userRow.certificates[0];
                    rows.push([stt++, `"${userRow.name}"`, `"${firstCert.name}"`, `"${firstCert.credits}"`, `"${userRow.totalCredits}"`].join(';'));
                    for (let i = 1; i < userRow.certificates.length; i++) {
                        const cert = userRow.certificates[i];
                        rows.push([ '', '', `"${cert.name}"`, `"${cert.credits}"`, '' ].join(';'));
                    }
                }
            });
            csvContent = [headers.join(';'), ...rows].join('\n');
        } else if (reportType === 'department' || reportType === 'title_detail') {
            const isDeptReport = reportType === 'department';
            const groupHeaderLabel = isDeptReport ? 'Khoa/Phòng' : 'Chức danh';
            const groupMap = isDeptReport ? departmentMap : titleMap;
            const data = sortedReportData as SummaryReportRow[];
            
            const groupedData: { [key: string]: { rows: SummaryReportRow[], totalCredits: number } } = {};
            data.forEach(row => {
                const groupId = isDeptReport ? row.departmentId : row.titleId;
                if (!groupId) return;
                if (!groupedData[groupId]) {
                    groupedData[groupId] = { rows: [], totalCredits: 0 };
                }
                groupedData[groupId].rows.push(row);
                groupedData[groupId].totalCredits += row.totalCredits;
            });
            
            const sortedGroupIds = Object.keys(groupedData).sort((a, b) => {
                const nameA = groupMap.get(a) || '';
                const nameB = groupMap.get(b) || '';
                return nameA.localeCompare(nameB, 'vi');
            });

            const headers = ['STT', 'Họ tên', 'Tổng số tiết'];
            const rows: string[] = [];

            sortedGroupIds.forEach(groupId => {
                const group = groupedData[groupId];
                const groupName = groupMap.get(groupId) || 'Không xác định';

                rows.push([`"${groupHeaderLabel}: ${groupName}"`, '', ''].join(';'));

                group.rows.forEach((row, index) => {
                    rows.push([`"${index + 1}"`, `"${row.name}"`, `"${row.totalCredits}"`].join(';'));
                });
                
                rows.push(['"Tổng cộng"', '', `"${group.totalCredits}"`].join(';'));
                rows.push(['','',''].join(';')); 
            });

            csvContent = [headers.join(';'), ...rows].join('\n');
        } else {
            const headers = ['STT', ...Object.values(reportHeaders)];
            const keys = Object.keys(reportHeaders);
            const rows = sortedReportData.map((row, index) => [
                index + 1,
                ...keys.map(key => `"${String(row[key as keyof ReportRow]).replace(/"/g, '""')}"`)
            ].join(';'));
             csvContent = [headers.join(';'), ...rows].join('\n');
        }
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const today = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `BaoCao_${reportType}_${today}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportWord = () => {
        if (!sortedReportData) return;
    
        const reportTitleOptions: { [key: string]: string } = {
            compliance: 'Báo cáo Tuân thủ theo Chu kỳ',
            summary_with_details: 'Báo cáo Tổng hợp có Chi tiết',
            summary: 'Báo cáo tổng hợp toàn bộ',
            detail: 'Báo cáo chi tiết chứng chỉ',
            department: 'Báo cáo tổng hợp theo Khoa/Phòng',
            title_detail: 'Báo cáo tổng hợp theo Chức danh',
        };
        const reportTitle = reportTitleOptions[reportType] || 'Báo cáo';
    
        const styles = `
            <style>
                body { font-family: 'Times New Roman', serif; font-size: 12pt; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #000; padding: 5px; text-align: left; vertical-align: top; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .report-title { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px; }
                .group-header-row { font-weight: bold; background-color: #e6e6e6; }
                .group-footer-row { font-weight: bold; }
            </style>
        `;
    
        let tableHtml = '<table>';
    
        if (reportType === 'detail' || reportType === 'summary_with_details') {
            tableHtml += `<thead><tr><th>STT</th><th>Họ và tên</th><th>Tên chứng chỉ</th><th>Số tiết</th><th>Tổng tiết</th></tr></thead><tbody>`;
            let stt = 1;
            (sortedReportData as (DetailedReportRow | SummaryWithDetailsRow)[]).forEach(userRow => {
                if (userRow.certificates.length > 0) {
                    userRow.certificates.forEach((cert, certIndex) => {
                        tableHtml += `<tr>`;
                        if (certIndex === 0) {
                            tableHtml += `<td rowspan="${userRow.certificates.length}">${stt}</td>`;
                            tableHtml += `<td rowspan="${userRow.certificates.length}">${userRow.name}</td>`;
                        }
                        tableHtml += `<td>${cert.name}</td><td>${cert.credits}</td>`;
                        if (certIndex === 0) {
                            tableHtml += `<td rowspan="${userRow.certificates.length}">${userRow.totalCredits}</td>`;
                        }
                        tableHtml += `</tr>`;
                    });
                    stt++;
                }
            });
            tableHtml += `</tbody>`;
        } else if (reportType === 'department' || reportType === 'title_detail') {
            tableHtml += `<thead><tr><th>STT</th><th>Họ tên</th><th>Tổng số tiết</th></tr></thead><tbody>`;
            const isDeptReport = reportType === 'department';
            const groupHeaderLabel = isDeptReport ? 'Khoa/Phòng' : 'Chức danh';
            const groupMap = isDeptReport ? departmentMap : titleMap;
            const data = sortedReportData as SummaryReportRow[];
            
            const groupedData: { [key: string]: { rows: SummaryReportRow[], totalCredits: number } } = {};
            data.forEach(row => {
                const groupId = isDeptReport ? row.departmentId : row.titleId;
                if (!groupId) return;
                if (!groupedData[groupId]) groupedData[groupId] = { rows: [], totalCredits: 0 };
                groupedData[groupId].rows.push(row);
                groupedData[groupId].totalCredits += row.totalCredits;
            });
            
            const sortedGroupIds = Object.keys(groupedData).sort((a,b) => (groupMap.get(a) || '').localeCompare(groupMap.get(b) || '', 'vi'));
    
            sortedGroupIds.forEach(groupId => {
                const group = groupedData[groupId];
                const groupName = groupMap.get(groupId) || 'Không xác định';
                tableHtml += `<tr class="group-header-row"><td colspan="3">${groupHeaderLabel}: ${groupName}</td></tr>`;
                group.rows.forEach((row, index) => {
                    tableHtml += `<tr><td>${index + 1}</td><td>${row.name}</td><td>${row.totalCredits}</td></tr>`;
                });
                tableHtml += `<tr class="group-footer-row"><td colspan="2" style="text-align: right;">Tổng cộng</td><td>${group.totalCredits}</td></tr>`;
            });
            tableHtml += `</tbody>`;
        } else {
            tableHtml += `<thead><tr><th>STT</th>${Object.values(reportHeaders).map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
            const keys = Object.keys(reportHeaders);
            sortedReportData.forEach((row, index) => {
                tableHtml += `<tr><td>${index + 1}</td>`;
                tableHtml += keys.map(key => `<td>${(row as any)[key] ?? ''}</td>`).join('');
                tableHtml += `</tr>`;
            });
            tableHtml += `</tbody>`;
        }
    
        tableHtml += '</table>';
    
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">${styles}</head><body><div class="report-title">${reportTitle}</div>${tableHtml}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'application/msword' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `BaoCao_${reportType}_${today}.doc`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const renderCellContent = (row: ReportRow, key: string): ReactNode => {
        if (key === 'actions' && reportType === 'summary_with_details') {
            return (
                <button
                    onClick={() => setDetailModalUser(row as SummaryWithDetailsRow)}
                    className="text-teal-600 font-semibold hover:underline"
                >
                    Xem
                </button>
            );
        }
        
        const value = (row as any)[key];

        if (key === 'status' && 'status' in row) {
            const status = row.status;
            const isCompliant = status === 'Đã đạt';
            return (
                <span className={`px-2 inline-flex text-sm leading-5 font-semibold rounded-full ${isCompliant ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {status}
                </span>
            );
        }

        if (typeof value === 'string' || typeof value === 'number') {
            return value;
        }

        return 'N/A';
    };

    const handleAiSummary = async () => {
        if (!sortedReportData || !geminiApiKey) {
            setSummaryError('Không thể tóm tắt: Thiếu dữ liệu báo cáo hoặc API key.');
            return;
        }
    
        setIsSummarizing(true);
        setAiSummary(null);
        setSummaryError(null);
    
        try {
            // Simplify data for the prompt to keep it concise and relevant
            const simplifiedData = sortedReportData.map(row => {
                const simpleRow: { [key: string]: any } = {};
                switch(reportType) {
                    case 'compliance':
                        simpleRow.name = row.name;
                        simpleRow.status = (row as ComplianceReportRow).status;
                        simpleRow.totalCredits = (row as ComplianceReportRow).totalCredits;
                        simpleRow.requirement = (row as ComplianceReportRow).requirement;
                        break;
                    case 'summary_with_details':
                    case 'summary':
                    case 'department':
                    case 'title_detail':
                        simpleRow.name = row.name;
                        simpleRow.totalCredits = (row as SummaryReportRow).totalCredits;
                        if ('department' in row) simpleRow.department = (row as SummaryReportRow).department;
                        if ('title' in row) simpleRow.title = (row as SummaryReportRow).title;
                        break;
                    default: // Fallback for other or detail types
                        simpleRow.name = row.name;
                        if ('totalCredits' in row) simpleRow.totalCredits = (row as { totalCredits: number }).totalCredits;
                }
                return simpleRow;
            }).slice(0, 50); // Limit to first 50 records to avoid overly large prompts
    
            const dataString = JSON.stringify(simplifiedData);
            
            const reportTitleOptions: { [key: string]: string } = {
                compliance: 'Báo cáo Tuân thủ theo chu kỳ',
                summary_with_details: 'Báo cáo Tổng hợp có Chi tiết',
                summary: 'Báo cáo tổng hợp toàn bộ',
                detail: 'Báo cáo chi tiết chứng chỉ',
                department: 'Báo cáo tổng hợp theo Khoa/Phòng',
                title_detail: 'Báo cáo tổng hợp theo Chức danh',
            };
            const reportName = reportTitleOptions[reportType] || 'Báo cáo';
    
            const prompt = `Bạn là một trợ lý phân tích dữ liệu chuyên nghiệp. Dựa trên dữ liệu báo cáo dạng JSON sau đây về "${reportName}", hãy viết một bản tóm tắt ngắn gọn bằng tiếng Việt (khoảng 3-4 câu) về những điểm nổi bật nhất, các xu hướng chính, hoặc các điểm cần lưu ý. Trả lời trực tiếp vào vấn đề, không cần lời chào. Dữ liệu: ${dataString}`;
    
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
    
            setAiSummary(response.text);
    
        } catch (error) {
            console.error("AI summary error:", error);
            setSummaryError('Đã xảy ra lỗi khi tạo tóm tắt. Vui lòng thử lại.');
        } finally {
            setIsSummarizing(false);
        }
    };

    const renderTimeFilters = () => (
        <div className="mt-4 p-4 border border-gray-200 rounded-md space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <label className="font-medium text-gray-700">Lọc theo:</label>
                <div className="flex items-center gap-2"><input type="radio" id="filter_year" name="filterMode" value="year" checked={filterMode === 'year'} onChange={() => setFilterMode('year')} /><label htmlFor="filter_year">Năm</label></div>
                <div className="flex items-center gap-2"><input type="radio" id="filter_all" name="filterMode" value="all" checked={filterMode === 'all'} onChange={() => setFilterMode('all')} /><label htmlFor="filter_all">Tất cả</label></div>
                <div className="flex items-center gap-2"><input type="radio" id="filter_range" name="filterMode" value="range" checked={filterMode === 'range'} onChange={() => setFilterMode('range')} /><label htmlFor="filter_range">Khoảng ngày</label></div>
            </div>
            {filterMode === 'year' && (<div className="mt-2"><select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full sm:w-auto mt-1 block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 rounded-md">{yearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select></div>)}
            {filterMode === 'range' && (<div className="flex flex-col sm:flex-row items-center gap-4 mt-2"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full sm:w-auto mt-1 block py-2 px-3 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 rounded-md" /><span className="text-gray-500">đến</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full sm:w-auto mt-1 block py-2 px-3 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 rounded-md" /></div>)}
        </div>
    );

    const renderFilters = () => {
        if (['summary', 'detail', 'summary_with_details'].includes(reportType)) return renderTimeFilters();
        if (reportType === 'department') return (
            <>
            <div className="mt-4">
                <label htmlFor="departmentFilter" className="block text-base font-medium text-gray-700">Khoa/Phòng</label>
                <select id="departmentFilter" value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 rounded-md">
                    <option value="all">Tất cả Khoa/Phòng</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>
            {renderTimeFilters()}
            </>
        );
        if (reportType === 'title_detail') return (
             <>
            <div className="mt-4">
                <label htmlFor="titleFilter" className="block text-base font-medium text-gray-700">Chức danh</label>
                <select id="titleFilter" value={selectedTitle} onChange={e => setSelectedTitle(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 rounded-md">
                    <option value="all">Tất cả Chức danh</option>
                    {titles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            {renderTimeFilters()}
            </>
        );
        if (reportType === 'compliance' && settings) return <p className="mt-2 text-sm text-gray-500">Báo cáo sẽ được tạo dựa trên chu kỳ tuân thủ đã cài đặt: {settings.complianceStartYear} - {settings.complianceEndYear}.</p>;
        return null;
    };
    
    const renderStandardReport = () => (
        <table className="min-w-full bg-white border border-gray-300 border-collapse">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-12">STT</th>
                    {Object.entries(reportHeaders).map(([key, value]) => (
                        <th key={key}
                            className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 cursor-pointer"
                            onClick={() => requestSort(key)}
                        >
                            {value}
                            <span className="ml-1">{getSortIndicator(key)}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {sortedReportData!.map((row, index) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 border border-gray-300 text-center">{index + 1}</td>
                        {Object.keys(reportHeaders).map(key => (
                            <td key={key} className="px-4 py-3 border border-gray-300 align-top">
                                {renderCellContent(row, key)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
    
    const renderDetailedReport = () => (
        <table className="min-w-full bg-white border border-gray-300 border-collapse">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-12">STT</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Họ và tên</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Tên chứng chỉ</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-24">Số tiết</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-24">Tổng tiết</th>
                </tr>
            </thead>
            <tbody>
                {(sortedReportData as DetailedReportRow[]).flatMap((userRow, userIndex) => 
                    userRow.certificates.map((cert, certIndex) => (
                        <tr key={`${userRow.id}-${certIndex}`} className="hover:bg-gray-50">
                            {certIndex === 0 && (
                                <>
                                    <td rowSpan={userRow.certificates.length} className="px-4 py-3 border border-gray-300 text-center align-top">{userIndex + 1}</td>
                                    <td rowSpan={userRow.certificates.length} className="px-4 py-3 border border-gray-300 align-top">{userRow.name}</td>
                                </>
                            )}
                            <td className="px-4 py-3 border border-gray-300">{cert.name}</td>
                            <td className="px-4 py-3 border border-gray-300 text-center">{cert.credits}</td>
                            {certIndex === 0 && (
                                <td rowSpan={userRow.certificates.length} className="px-4 py-3 border border-gray-300 text-center align-top">{userRow.totalCredits}</td>
                            )}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );

    const renderGroupedReport = (groupBy: 'department' | 'title') => {
        const groupMap = groupBy === 'department' ? departmentMap : titleMap;
        const groupHeaderLabel = groupBy === 'department' ? 'Khoa/Phòng' : 'Chức danh';
        const data = sortedReportData as SummaryReportRow[];
        const groupedData: { [key: string]: { rows: SummaryReportRow[], totalCredits: number } } = {};

        data.forEach(row => {
            const groupId = groupBy === 'department' ? row.departmentId : row.titleId;
            if (!groupId) return;
            if (!groupedData[groupId]) {
                groupedData[groupId] = { rows: [], totalCredits: 0 };
            }
            groupedData[groupId].rows.push(row);
            groupedData[groupId].totalCredits += row.totalCredits;
        });

        const sortedGroupIds = Object.keys(groupedData).sort((a, b) => {
            const nameA = groupMap.get(a) || '';
            const nameB = groupMap.get(b) || '';
            return nameA.localeCompare(nameB, 'vi');
        });

        return (
            <table className="min-w-full bg-white border border-gray-300 border-collapse">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-12">STT</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Họ tên</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-32">Tổng số tiết</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedGroupIds.length === 0 && (
                        <tr>
                            <td colSpan={3} className="text-center py-4 text-gray-500">Không có dữ liệu cho lựa chọn này.</td>
                        </tr>
                    )}
                    {sortedGroupIds.flatMap(groupId => {
                        const group = groupedData[groupId];
                        const groupName = groupMap.get(groupId) || 'Không xác định';
                        const groupRows = group.rows.map((row, index) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 border border-gray-300 text-center">{index + 1}</td>
                                <td className="px-4 py-3 border border-gray-300">{row.name}</td>
                                <td className="px-4 py-3 border border-gray-300 text-center">{row.totalCredits}</td>
                            </tr>
                        ));

                        return [
                            <tr key={`${groupId}-header`} className="bg-teal-50 sticky top-0">
                                <td colSpan={3} className="px-4 py-2 border border-gray-300 font-bold text-teal-800">{groupHeaderLabel}: {groupName}</td>
                            </tr>,
                            ...groupRows,
                            <tr key={`${groupId}-footer`} className="bg-gray-100">
                                <td colSpan={2} className="px-4 py-2 border border-gray-300 text-right font-bold">Tổng cộng</td>
                                <td className="px-4 py-2 border border-gray-300 text-center font-bold">{group.totalCredits}</td>
                            </tr>
                        ];
                    })}
                </tbody>
            </table>
        );
    };


    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg shadow-md no-print">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Tạo báo cáo</h2>
                <div className="space-y-3">
                     <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-grow w-full sm:w-auto">
                            <label htmlFor="reportType" className="block text-base font-medium text-gray-700">Loại báo cáo</label>
                            <select id="reportType" value={reportType} onChange={(e) => { setReportType(e.target.value); setReportData(null); }} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 rounded-md">
                                {reportOptions.map(opt => <option key={opt.value} value={opt.value} disabled={opt.value === ''}>{opt.label}</option>)}
                            </select>
                        </div>
                        <button type="button" onClick={handleGenerateReport} disabled={!reportType || isGenerating} className="w-full sm:w-auto bg-teal-600 text-white font-semibold py-2 px-4 rounded-md text-base transition-colors hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-wait flex-shrink-0">
                            {isGenerating ? 'Đang tạo...' : 'Tạo báo cáo'}
                        </button>
                    </div>
                     {renderFilters()}
                </div>
            </div>

            {isGenerating && <div className="text-center p-4">Đang xử lý dữ liệu...</div>}
            
            {sortedReportData && (
                <div id="printable-report" className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4 no-print">
                        <h3 className="text-lg font-semibold text-gray-800">Kết quả báo cáo</h3>
                         <div className="flex items-center flex-wrap justify-end gap-3">
                             <div className="relative" ref={exportMenuRef}>
                                <button onClick={() => setIsExportMenuOpen(prev => !prev)} className="flex items-center gap-2 text-base bg-gray-700 text-white font-semibold py-2 px-3 rounded-md hover:bg-gray-800 transition-colors">
                                    <ExportIcon className="h-5 w-5" />
                                    <span>Xuất file</span>
                                    <ChevronDownIcon className="h-4 w-4" />
                                </button>
                                {isExportMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
                                        <button onClick={() => { handlePrint(); setIsExportMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><PrintIcon className="h-5 w-5" /> In</button>
                                        <button onClick={() => { handleExportExcel(); setIsExportMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ExportIcon className="h-5 w-5 text-green-600" /> Xuất Excel</button>
                                        <button onClick={() => { handleExportWord(); setIsExportMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><WordIcon className="h-5 w-5" /> Xuất Word</button>
                                    </div>
                                )}
                            </div>
                            {['admin', 'reporter', 'reporter_user'].includes(user.role) && (
                                <button onClick={handleShareReport} className="flex items-center gap-2 text-base bg-blue-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-blue-700 transition-colors">
                                    <ShareIcon className="h-5 w-5" />
                                    <span>Chia sẻ</span>
                                </button>
                            )}
                            <button 
                                onClick={handleAiSummary}
                                disabled={isSummarizing || !geminiApiKey}
                                className="flex items-center gap-2 text-base bg-indigo-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-wait"
                                title={!geminiApiKey ? "Chưa cấu hình API Key" : "Tóm tắt bằng AI"}
                            >
                                <SparklesIcon className="h-5 w-5" />
                                <span>{isSummarizing ? 'Đang tóm tắt...' : 'Tóm tắt AI'}</span>
                            </button>
                        </div>
                    </div>
                    
                    {(isSummarizing || aiSummary || summaryError) && (
                        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 no-print animate-fade-in">
                            <h4 className="flex items-center gap-2 text-base font-semibold text-blue-800">
                                <SparklesIcon className="h-5 w-5" />
                                AI Tóm tắt
                            </h4>
                            {isSummarizing && <p className="mt-2 text-blue-700">Đang phân tích dữ liệu, vui lòng chờ...</p>}
                            {summaryError && <p className="mt-2 text-red-600">{summaryError}</p>}
                            {aiSummary && <p className="mt-2 text-blue-900 whitespace-pre-wrap">{aiSummary}</p>}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        {reportType === 'detail' ? renderDetailedReport() : 
                         reportType === 'department' ? renderGroupedReport('department') :
                         reportType === 'title_detail' ? renderGroupedReport('title') :
                         renderStandardReport()}
                    </div>
                </div>
            )}
            
            {shareModalInfo && (
                <ShareReportModal
                    shareUrl={shareModalInfo.url}
                    expiresAt={shareModalInfo.expiresAt}
                    token={shareModalInfo.token}
                    userRole={user.role}
                    onClose={() => setShareModalInfo(null)}
                />
            )}
            
            {detailModalUser && (
                <CertificateDetailModal
                    user={detailModalUser}
                    onClose={() => setDetailModalUser(null)}
                />
            )}


            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 1cm;
                    }
                    body * { visibility: hidden; }
                    .no-print, .no-print * { display: none !important; }
                    #printable-report, #printable-report * { visibility: visible; }
                    #printable-report { 
                        position: absolute; left: 0; top: 0; width: 100%; 
                        box-shadow: none !important; border: none !important; 
                        padding: 0 !important; margin: 0 !important; 
                    }
                    table { 
                        font-size: 9pt !important; 
                        width: 100% !important; 
                        border-collapse: collapse !important;
                    }
                    thead { display: table-header-group !important; }
                    tbody, tr { page-break-inside: avoid !important; }
                    th, td {
                        border: 1px solid #000 !important;
                        padding: 4px !important;
                        color: #000 !important;
                        background-color: #fff !important; /* Force transparent background */
                    }
                    tr.bg-teal-50 > td, tr.bg-gray-100 > td {
                        font-weight: bold !important;
                        background-color: #eee !important;
                    }
                    span.rounded-full {
                        background-color: transparent !important;
                        border: 1px solid #000 !important;
                        color: #000 !important;
                        padding: 1px 4px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Reporting;