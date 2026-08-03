import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('finance_user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;
      setUser(userData);
      localStorage.setItem('finance_user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      return userData;
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  };

  const register = async (payload) => {
    try {
      const response = await api.post('/auth/register', payload);
      const { token, user: userData, message } = response.data;
      
      if (token) {
        setUser(userData);
        localStorage.setItem('finance_user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        return { user: userData };
      } else {
        // Coach registration flow, pending approval
        return { message };
      }
    } catch (error) {
      console.error('Registration failed', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('finance_user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
