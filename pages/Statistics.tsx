import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserData, Certificate, AppSettings } from '../App';
import UserGroupIcon from '../components/icons/UserGroupIcon';
import CertificateBadgeIcon from '../components/icons/CertificateBadgeIcon';
import ClockIcon from '../components/icons/ClockIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';

const useCountUp = (endValue: string | number, duration: number = 1500) => {
    const [count, setCount] = useState('0');
    const isRate = typeof endValue === 'string' && endValue.includes('%');
    const end = typeof endValue === 'string' ? parseFloat(endValue) : endValue;

    useEffect(() => {
        if (isNaN(end)) {
            setCount(String(endValue));
            return;
        }

        let frame = 0;
        const frameRate = 1000 / 60;
        const totalFrames = Math.round(duration / frameRate);
        
        const counter = setInterval(() => {
            frame++;
            const progress = frame / totalFrames;
            // Ease out cubic function
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentCount = end * easedProgress;
            
            if (isRate) {
                setCount(currentCount.toFixed(0) + '%');
            } else if (end < 1 && end > 0) {
                 setCount(currentCount.toFixed(1));
            } else {
                 setCount(Math.round(currentCount).toString());
            }

            if (frame >= totalFrames) {
                clearInterval(counter);
                setCount(String(endValue)); // Ensure it ends on the exact value
            }
        }, frameRate);

        return () => clearInterval(counter);
    }, [endValue, duration]);
    
    return count;
};


const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; color: string; }> = ({ icon, title, value, color }) => {
    const displayValue = useCountUp(value);
    return (
        <div className={`p-5 rounded-lg shadow-lg flex flex-col justify-between text-white ${color} transform transition-transform duration-300 hover:-translate-y-1`}>
            <div className="flex justify-between items-start">
                <p className="text-base font-bold uppercase">{title}</p>
                <div className="opacity-50 text-3xl">
                    {icon}
                </div>
            </div>
            <p className="text-4xl font-bold mt-2">{displayValue}</p>
        </div>
    );
};

const BarChart: React.FC<{ data: number[], year: string }> = ({ data, year }) => {
    const maxValue = Math.max(...data, 1);
    const yAxisLabels = [0, Math.ceil(maxValue / 2), maxValue];
    const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

    return (
        <div className="w-full h-72 flex flex-col">
            <div className="flex-grow flex gap-2">
                <div className="flex flex-col justify-between h-full text-sm text-gray-400">
                    {yAxisLabels.slice().reverse().map(label => <span key={label}>{label}</span>)}
                </div>
                <div className="flex-grow grid grid-cols-12 gap-2 items-end border-l border-b border-gray-200 pl-2">
                    {data.map((value, index) => (
                        <div key={index} className="flex flex-col items-center group relative h-full justify-end">
                            <div className="absolute -top-6 hidden group-hover:block bg-gray-700 text-white text-sm rounded py-1 px-2">
                                {value}
                            </div>
                            <div className="w-full bg-teal-300 hover:bg-teal-400 transition-colors rounded-t-sm bar-animate"
                                style={{ height: `${(value / maxValue) * 100}%`, animationDelay: `${index * 50}ms` }}
                                title={`${labels[index]}: ${value} chứng chỉ`}
                            >
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex">
                <div className="w-8"></div>
                <div className="flex-grow grid grid-cols-12 gap-2 pl-2">
                    {labels.map(label => (
                        <div key={label} className="text-center text-sm text-gray-500 pt-1">{label}</div>
                    ))}
                </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2 font-semibold">Số chứng chỉ năm {year}</p>
        </div>
    );
};

const LineChart: React.FC<{ data: number[], year: string }> = ({ data, year }) => {
    const pathRef = useRef<SVGPathElement>(null);
    const maxValue = Math.max(...data, 1);
    const yAxisLabels = [0, Math.ceil(maxValue / 2), maxValue];
    const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const width = 500;
    const height = 250;
    const padding = 30;

    const getCoords = (value: number, index: number) => ({
        x: padding + (index / (data.length - 1)) * (width - 2 * padding),
        y: height - padding - (value / maxValue) * (height - 2 * padding),
    });

    const pathData = data.map((value, index) => {
        const { x, y } = getCoords(value, index);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    useEffect(() => {
        if (pathRef.current) {
            const length = pathRef.current.getTotalLength();
            pathRef.current.style.strokeDasharray = `${length}`;
            pathRef.current.style.strokeDashoffset = `${length}`;
            setTimeout(() => {
                if(pathRef.current) pathRef.current.style.strokeDashoffset = '0';
            }, 100);
        }
    }, [pathData]);

    return (
        <div className="w-full h-72 flex flex-col items-center">
             <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                {/* Y Axis lines and labels */}
                {yAxisLabels.map(label => {
                    const y = height - padding - (label / maxValue) * (height - 2 * padding);
                    return (
                        <g key={label}>
                            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e5e7eb" strokeDasharray="2,2" />
                            <text x={padding - 10} y={y + 5} textAnchor="end" fontSize="10" fill="#9ca3af">{label}</text>
                        </g>
                    );
                })}
                {/* X Axis labels */}
                 {labels.map((label, index) => {
                    const { x } = getCoords(0, index);
                    return <text key={index} x={x} y={height - padding + 15} textAnchor="middle" fontSize="10" fill="#6b7280">{label}</text>;
                })}

                <path
                    ref={pathRef}
                    d={pathData}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="2"
                    style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                />
                 {data.map((value, index) => {
                    const { x, y } = getCoords(value, index);
                    return (
                       <g key={index} className="group cursor-pointer point-animate" style={{ animationDelay: `${index * 100}ms`}}>
                            <circle cx={x} cy={y} r="8" fill="#14b8a6" fillOpacity="0" />
                            <circle cx={x} cy={y} r="4" fill="#14b8a6" className="transition-transform duration-200 group-hover:scale-125" />
                            <text x={x} y={y - 12} textAnchor="middle" fontSize="12" fill="#111827" className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                                {value}
                            </text>
                       </g>
                    );
                })}
            </svg>
            <p className="text-center text-sm text-gray-500 mt-2 font-semibold">Số chứng chỉ năm {year}</p>
        </div>
    );
};

const PieChart: React.FC<{ data: { [key: string]: number } }> = ({ data }) => {
    const colors = ['#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171', '#fb923c'];
    // FIX: Add explicit types to reduce callback parameters to prevent type inference issues.
    const total = Object.values(data).reduce((sum: number, value: number) => sum + value, 0);
    if (total === 0) return <div className="h-72 flex items-center justify-center"><p className="text-center text-gray-500">Không có dữ liệu để hiển thị.</p></div>;

    let startAngle = -90; // Start from the top
    const sortedYears = Object.keys(data).sort((a,b) => Number(b) - Number(a));

    const slices = sortedYears.map((year, index) => {
        const value = data[year];
        const angle = (value / total) * 360;
        const endAngle = startAngle + angle;

        const startRad = startAngle * Math.PI / 180;
        const endRad = endAngle * Math.PI / 180;

        const startX = 50 + 40 * Math.cos(startRad);
        const startY = 50 + 40 * Math.sin(startRad);
        const endX = 50 + 40 * Math.cos(endRad);
        const endY = 50 + 40 * Math.sin(endRad);

        const largeArcFlag = angle > 180 ? 1 : 0;
        const pathData = `M 50,50 L ${startX},${startY} A 40,40 0 ${largeArcFlag},1 ${endX},${endY} Z`;

        startAngle = endAngle;

        return { path: pathData, color: colors[index % colors.length], year, value };
    });

    return (
        <div className="w-full flex flex-col md:flex-row items-center justify-center gap-8 h-72">
            <svg viewBox="0 0 100 100" className="w-56 h-56 md:w-64 md:h-64">
                {slices.map((slice, index) => (
                    <g key={index} className="group cursor-pointer pie-slice" style={{ animationDelay: `${index * 100}ms` }}>
                        <path 
                            d={slice.path} 
                            fill={slice.color} 
                            className="transition-transform duration-200 origin-center group-hover:scale-105" 
                        />
                        {/* FIX: Changed title to reflect sum of credits ('tiết') instead of count of certificates ('chứng chỉ') */}
                        <title>{`${slice.year}: ${slice.value} tiết`}</title>
                    </g>
                ))}
            </svg>
            <div className="flex flex-col gap-2">
                <p className="font-semibold text-gray-700 mb-2">Chú giải</p>
                {slices.map((slice, index) => (
                    <div key={index} className="flex items-center gap-3 pie-legend" style={{ animationDelay: `${index * 100 + 200}ms` }}>
                        <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: slice.color }}></div>
                        <span className="text-gray-600 text-base">{slice.year}: <span className="font-bold">{slice.value}</span></span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// FIX: Cannot find name 'StatisticsProps'.
interface StatisticsProps {
    users: UserData[];
    certificates: Certificate[];
    settings: AppSettings | null;
}

const Statistics: React.FC<StatisticsProps> = ({ users, certificates, settings }) => {
    const currentYear = new Date().getFullYear().toString();
    const [chartYear, setChartYear] = useState(currentYear);
    const [chartType, setChartType] = useState('column'); // 'column', 'line', 'pie'

    const { filteredUsers, filteredCertificates } = useMemo(() => {
        const validRoles: UserData['role'][] = ['user', 'reporter_user'];
        const filteredUsers = users.filter(user => validRoles.includes(user.role) && user.status !== 'disabled');
        const filteredUserIds = new Set(filteredUsers.map(u => u.id));
        const filteredCertificates = certificates.filter(cert => filteredUserIds.has(cert.userId));
        return { filteredUsers, filteredCertificates };
    }, [users, certificates]);

    const summaryStats = useMemo(() => {
        const totalUsers = filteredUsers.length;

        if (!settings || totalUsers === 0) {
            return { totalCerts: 0, averageCredits: '0.0', complianceRate: '0%' };
        }

        const certsInCycle = filteredCertificates.filter(cert => {
            const certYear = cert.date.toDate().getFullYear();
            return certYear >= settings.complianceStartYear && certYear <= settings.complianceEndYear;
        });

        const totalCerts = certsInCycle.length;
        // FIX: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
        const totalCreditsInCycle = certsInCycle.reduce((sum: number, cert: Certificate) => sum + Number(cert.credits), 0);
        const averageCredits = totalUsers > 0 ? (totalCreditsInCycle / totalUsers).toFixed(1) : '0.0';

        let compliantUsers = 0;
        const creditsPerUser = new Map<string, number>();
        certsInCycle.forEach(cert => {
            // FIX: Explicitly cast `cert.credits` to a number to prevent arithmetic errors with inconsistent data types from Firestore.
            creditsPerUser.set(cert.userId, (creditsPerUser.get(cert.userId) || 0) + Number(cert.credits));
        });

        filteredUsers.forEach(user => {
            const isPharmacist = user.titleId === '4';
            const complianceTarget = isPharmacist ? 8 : 120;
            const userCredits = creditsPerUser.get(user.id) || 0;

            if (userCredits >= complianceTarget) {
                compliantUsers++;
            }
        });
        
        const complianceRate = totalUsers > 0 ? ((compliantUsers / totalUsers) * 100).toFixed(0) + '%' : '0%';

        return { totalCerts, averageCredits, complianceRate };
    }, [filteredUsers, filteredCertificates, settings]);

    const yearOptions = useMemo(() => {
        const years = new Set(filteredCertificates.map(c => c.date.toDate().getFullYear()));
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a).map(String);
    }, [filteredCertificates]);

    const monthlyChartData = useMemo(() => {
        const monthlyCerts = Array(12).fill(0);
        filteredCertificates
            .filter(c => c.date.toDate().getFullYear().toString() === chartYear)
            .forEach(c => {
                const month = c.date.toDate().getMonth();
                monthlyCerts[month]++;
            });
        return monthlyCerts;
    }, [filteredCertificates, chartYear]);

     const pieChartData = useMemo(() => {
        const data: { [key: string]: number } = {};
        filteredCertificates.forEach(cert => {
            const year = cert.date.toDate().getFullYear().toString();
            // FIX: The left-hand side and right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
            data[year] = (data[year] ?? 0) + Number(cert.credits);
        });
        return data;
    }, [filteredCertificates]);

    return (
        <div className="space-y-4">
             <style>{`
                @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
                .bar-animate { animation: grow 0.5s ease-out forwards; transform-origin: bottom; }

                @keyframes pop-in { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
                .point-animate { animation: pop-in 0.3s ease-out forwards; opacity: 0; transform-origin: center; animation-fill-mode: forwards; }
                
                @keyframes pie-slice-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                .pie-slice { animation: pie-slice-in 0.5s ease-out forwards; opacity: 0; transform-origin: 50% 50%; }

                @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .pie-legend { animation: fade-in-up 0.4s ease-out forwards; opacity: 0; }
            `}</style>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<UserGroupIcon className="h-6 w-6"/>} title="Tổng số nhân viên" value={filteredUsers.length} color="bg-gradient-to-br from-green-500 to-green-600" />
                <StatCard icon={<CertificateBadgeIcon className="h-6 w-6"/>} title="Tổng số chứng chỉ (Chu kỳ)" value={summaryStats.totalCerts} color="bg-gradient-to-br from-yellow-500 to-yellow-600" />
                <StatCard icon={<ClockIcon className="h-6 w-6"/>} title="Số tiết TB/NV (Chu kỳ)" value={summaryStats.averageCredits} color="bg-gradient-to-br from-blue-500 to-blue-600" />
                <StatCard icon={<CheckCircleIcon className="h-6 w-6"/>} title={`Tỷ lệ tuân thủ (${settings ? `${settings.complianceStartYear}-${settings.complianceEndYear}` : 'N/A'})`} value={summaryStats.complianceRate} color="bg-gradient-to-br from-purple-500 to-purple-600" />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                    <h2 className="text-lg font-semibold text-gray-800">Thống kê trực quan</h2>
                    <div className="flex items-center gap-2">
                        <select value={chartType} onChange={e => setChartType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-base">
                            <option value="column">Biểu đồ cột</option>
                            <option value="line">Biểu đồ đường</option>
                            <option value="pie">Biểu đồ tròn</option>
                        </select>
                        {chartType !== 'pie' && (
                             <select value={chartYear} onChange={e => setChartYear(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-base">
                                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        )}
                    </div>
                </div>
                {chartType === 'column' && <BarChart data={monthlyChartData} year={chartYear} />}
                {chartType === 'line' && <LineChart data={monthlyChartData} year={chartYear} />}
                {chartType === 'pie' && <PieChart data={pieChartData} />}
            </div>
        </div>
    );
};

export default Statistics;