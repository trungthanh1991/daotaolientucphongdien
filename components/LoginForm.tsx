import React, { useState } from 'react';
import LogoIcon from './icons/LogoIcon';
import EyeIcon from './icons/EyeIcon';
import EyeOffIcon from './icons/EyeOffIcon';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { UserData } from '../App';

interface LoginFormProps {
  onLoginSuccess: (user: UserData) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const usersRef = collection(db, 'Users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userDocRef = doc(db, 'Users', userDoc.id);
      let userData = userDoc.data() as Partial<UserData>;

      if (typeof userData.name !== 'string' || !userData.name.trim()) {
        console.error(`Login Error: User document '${userDoc.id}' has an invalid or missing 'name'.`);
        setError('Dữ liệu tài khoản không hợp lệ. Vui lòng liên hệ quản trị viên.');
        setLoading(false);
        return;
      }

      // Handle legacy boolean status
      if (typeof userData.status === 'boolean') {
          userData.status = userData.status ? 'active' : 'disabled';
      } else if (!userData.status) {
          userData.status = 'active';
      }

      if (userData.status === 'locked') {
        setError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        setLoading(false);
        return;
      }
      
      if (userData.status === 'disabled') {
        setError('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
        setLoading(false);
        return;
      }

      if (userData.password === password) {
        if (userData.failedLoginAttempts && userData.failedLoginAttempts > 0) {
          await updateDoc(userDocRef, { failedLoginAttempts: 0 });
          userData.failedLoginAttempts = 0; // Update local data as well
        }
        onLoginSuccess({ id: userDoc.id, ...userData } as UserData);
      } else {
        const currentAttempts = userData.failedLoginAttempts || 0;
        const newAttempts = currentAttempts + 1;
        
        if (newAttempts >= 5) {
            await updateDoc(userDocRef, {
                failedLoginAttempts: newAttempts,
                status: 'locked'
            });
            setError('Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng liên hệ quản trị viên.');
        } else {
            await updateDoc(userDocRef, {
                failedLoginAttempts: newAttempts
            });
            const attemptsLeft = 5 - newAttempts;
            setError(`Tên đăng nhập hoặc mật khẩu không chính xác. Bạn còn ${attemptsLeft} lần thử.`);
        }
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 sm:p-12 rounded-xl shadow-lg w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-block mb-6">
          <LogoIcon className="h-20 w-20" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-teal-800 tracking-wide uppercase">
          Hệ thống Quản lý
          <br />
          Đào tạo Liên tục
        </h1>
        <p className="text-gray-500 mt-2">Vui lòng đăng nhập để tiếp tục.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="block text-base font-medium text-gray-700 mb-1"
          >
            Tên đăng nhập
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-base font-medium text-gray-700 mb-1"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 rounded-full"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOffIcon className="h-6 w-6" />
              ) : (
                <EyeIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {error && (
            <p className="text-base text-red-600 text-center bg-red-50 p-3 rounded-md">{error}</p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors duration-200 disabled:bg-teal-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;