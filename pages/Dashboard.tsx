





import React, { useState } from 'react';
import Header from '../components/Header';
import Menubar from '../components/Menubar';
import Profile from './Profile';
import Administration from './Administration';
import AIAssistant from './AIAssistant';
import Certificates from './Certificates';
import Reports from './Reports';
import { UserData, Department, Title, AppSettings } from '../App';


interface DashboardProps {
  user: UserData;
  onLogout: () => void;
  onUserUpdate: (updatedUser: UserData) => void;
  departments: Department[];
  titles: Title[];
  settings: AppSettings | null;
  geminiApiKey: string | null;
  onKeysUpdate: () => void;
  onDepartmentsUpdate: () => void;
  onTitlesUpdate: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onUserUpdate, departments, titles, settings, geminiApiKey, onKeysUpdate, onDepartmentsUpdate, onTitlesUpdate }) => {
  const getDefaultPageForRole = (role: string | undefined): string => {
      switch (role) {
          case 'admin':
          case 'user':
          case 'reporter_user':
              return 'Trang cá nhân';
          case 'reporter':
              return 'Báo Cáo';
          default:
              return 'Trang cá nhân'; // Fallback for undefined roles
      }
  };
  
  const [activePage, setActivePage] = useState(getDefaultPageForRole(user.role));

  const renderContent = () => {
    switch (activePage) {
      case 'Trang cá nhân':
        return <Profile user={user} onUserUpdate={onUserUpdate} departments={departments} titles={titles} settings={settings} />;
      case 'Quản trị':
        if (user.role === 'admin') {
          return <Administration
                    currentUser={user}
                    departments={departments} 
                    titles={titles} 
                    onKeysUpdate={onKeysUpdate} 
                    onDepartmentsUpdate={onDepartmentsUpdate}
                    onTitlesUpdate={onTitlesUpdate}
                 />;
        }
        return <p>Bạn không có quyền truy cập trang này.</p>;
      case 'Trợ lý AI':
        return <AIAssistant geminiApiKey={geminiApiKey} />;
      case 'Chứng Chỉ':
        return <Certificates user={user} geminiApiKey={geminiApiKey} />;
      case 'Báo Cáo':
         if (user.role === 'admin' || user.role === 'reporter' || user.role === 'reporter_user') {
          return <Reports user={user} settings={settings} departments={departments} titles={titles} geminiApiKey={geminiApiKey} />;
        }
        return <p>Bạn không có quyền truy cập trang này.</p>;
      default:
        return <Profile user={user} onUserUpdate={onUserUpdate} departments={departments} titles={titles} settings={settings} />;
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800 md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop Menubar */}
      <div className="hidden md:block">
        <Menubar 
          user={user} 
          activeItem={activePage} 
          onSelectItem={setActivePage}
        />
      </div>

      <div className="flex flex-col w-full">
        <Header user={user} onLogout={onLogout} />

        {/* Mobile Menubar */}
        <div className="md:hidden">
            <Menubar 
                user={user} 
                activeItem={activePage} 
                onSelectItem={setActivePage} 
            />
        </div>
        
        <main className="flex-1 p-4">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;