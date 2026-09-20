import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const parseToken = (value) => {
    const payload = value.split('.')[1];

    if (!payload) {
      throw new Error('Invalid token');
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
    const decoded = new TextDecoder().decode(bytes);

    return JSON.parse(decoded);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      try {
        const payload = parseToken(storedToken);

        if (payload.exp && payload.exp * 1000 > Date.now()) {
          setToken(storedToken);
          setUser(payload);
        } else {
          localStorage.removeItem('token');
        }
      } catch {
        localStorage.removeItem('token');
      }
    }

    setIsLoading(false);
  }, []);

  const login = (newToken, providedUser = null) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);

    try {
      const payload = parseToken(newToken);
      setUser(providedUser || payload);
    } catch (err) {
      console.error('Invalid token payload', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
