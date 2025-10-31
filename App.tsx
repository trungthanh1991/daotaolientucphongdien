



import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './pages/Dashboard';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import SharedReportView from './pages/SharedReportView';

// Define a type for the user data from Firestore
export interface UserData {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'user' | 'reporter' | 'reporter_user';
  status: 'active' | 'disabled' | 'locked';
  failedLoginAttempts?: number;
  departmentId?: string;
  position?: string;
  titleId?: string;
  practiceCertificateNumber?: string;
  practiceCertificateIssueDate?: { toDate: () => Date };
  dateOfBirth?: { toDate: () => Date };
  password?: string; // Included for type safety but should not be exposed client-side
  [key: string]: any; // Allow other properties
}

export interface Department {
  id: string;
  name: string;
}

export interface Title {
  id: string;
  name: string;
}

export interface Certificate {
  id: string;
  name: string;
  credits: number;
  date: { toDate: () => Date };
  imageUrl: string;
  userId: string;
  updatedAt?: { toDate: () => Date };
}

export interface AppSettings {
  complianceStartYear: number;
  complianceEndYear: number;
}

export interface GeminiKey {
    id: string;
    key: string;
}


const App: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get('id');

  if (shareId) {
    return <SharedReportView shareId={shareId} />;
  }
  
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);

  const fetchGeminiKey = async () => {
    try {
        const keyCollection = collection(db, 'KeyGemini');
        const keySnapshot = await getDocs(keyCollection);
        if (!keySnapshot.empty) {
            // Use the first key found
            const keyDoc = keySnapshot.docs[0];
            const keyData = keyDoc.data();
            setGeminiApiKey(keyData.key);
            console.log("Gemini API Key loaded successfully.");
        } else {
            console.warn("No Gemini API Key found in Firestore. AI features will be disabled.");
            setGeminiApiKey(null);
        }
    } catch (error) {
        console.error("Error fetching Gemini API Key:", error);
        setGeminiApiKey(null);
    }
  };

  const fetchDepartments = async () => {
      try {
          const departmentsCollection = collection(db, 'Departments');
          const departmentsSnapshot = await getDocs(departmentsCollection);
          const departmentsList = departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
          setDepartments(departmentsList);
      } catch (error) {
          console.error("Error fetching departments:", error);
      }
  };

  const fetchTitles = async () => {
      try {
          const titlesCollection = collection(db, 'Titles');
          const titlesSnapshot = await getDocs(titlesCollection);
          const titlesList = titlesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Title));
          setTitles(titlesList);
      } catch (error) {
          console.error("Error fetching titles:", error);
      }
  };

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const settingsCollection = collection(db, 'Settings');
            const settingsSnapshot = await getDocs(settingsCollection);
            if (!settingsSnapshot.empty) {
                const settingsDoc = settingsSnapshot.docs[0];
                const data = settingsDoc.data();
                setSettings({
                    complianceStartYear: data.complianceStartYear,
                    complianceEndYear: data.complianceEndYear,
                });
            } else {
                const currentYear = new Date().getFullYear();
                console.warn("Settings not found, using default 5-year cycle.");
                setSettings({
                    complianceStartYear: currentYear,
                    complianceEndYear: currentYear + 4,
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
             const currentYear = new Date().getFullYear();
            setSettings({
                complianceStartYear: currentYear,
                complianceEndYear: currentYear + 4,
            });
        }
    };

    fetchDepartments();
    fetchTitles();
    fetchSettings();
    fetchGeminiKey();
  }, []);

  const handleLoginSuccess = (userData: UserData) => {
    setCurrentUser(userData);
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
  }

  const handleUserUpdate = (updatedUserData: UserData) => {
    setCurrentUser(updatedUserData);
  }

  return currentUser ? (
    <Dashboard 
      user={currentUser} 
      onLogout={handleLogout} 
      onUserUpdate={handleUserUpdate} 
      departments={departments}
      titles={titles}
      settings={settings}
      geminiApiKey={geminiApiKey}
      onKeysUpdate={fetchGeminiKey}
      onDepartmentsUpdate={fetchDepartments}
      onTitlesUpdate={fetchTitles}
    />
  ) : (
    <LoginPage onLoginSuccess={handleLoginSuccess} />
  );
};

interface LoginPageProps {
    onLoginSuccess: (user: UserData) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => (
  <div className="bg-gradient-to-br from-teal-50 to-sky-100 min-h-screen flex flex-col items-center justify-center p-4 font-sans">
    <div className="relative -top-[50px]">
        <main className="w-full">
          <LoginForm onLoginSuccess={onLoginSuccess} />
        </main>
        <footer className="w-full text-center py-4 text-gray-500 text-base">
          Design by Nguyễn Trung Thành
        </footer>
    </div>
  </div>
);

export default App;