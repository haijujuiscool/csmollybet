import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get('/api/me', {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => {
                setUser(res.data);
            })
            .catch(() => {
                localStorage.removeItem('token');
            })
            .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const refreshBalance = async () => {
        const token = localStorage.getItem('token');
        if (token && user) {
            try {
                const res = await axios.get('/api/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(res.data);
            } catch (err) {
                console.error(err);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading, refreshBalance }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
