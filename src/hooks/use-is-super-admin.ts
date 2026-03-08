import { useState, useEffect } from "react";
import axios from "axios";

export const useIsSuperAdmin = () => {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSuperAdminStatus = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    setIsSuperAdmin(false);
                    setLoading(false);
                    return;
                }
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data.is_super_admin) {
                    setIsSuperAdmin(true);
                } else {
                    setIsSuperAdmin(false);
                }
            } catch (error) {
                console.error("Erro ao verificar permissão de super admin:", error);
                setIsSuperAdmin(false);
            } finally {
                setLoading(false);
            }
        };
        checkSuperAdminStatus();
    }, []);

    return { isSuperAdmin, loading };
};
