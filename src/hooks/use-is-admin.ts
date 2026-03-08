import { useState, useEffect } from "react";
import axios from "axios";

export const useIsAdmin = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    setIsAdmin(false);
                    setLoading(false);
                    return;
                }
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data.is_admin || response.data.is_super_admin) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }
            } catch (error) {
                console.error("Erro ao verificar permissão de admin:", error);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        };
        checkAdminStatus();
    }, []);

    return { isAdmin, loading };
};
