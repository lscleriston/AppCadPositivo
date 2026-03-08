import { useState, useEffect } from 'react';
import axios from 'axios';

interface CurrentUser {
  matricula: string;
  nome: string;
  is_admin: boolean;
  is_super_admin: boolean;
  dados_completos: boolean;
  // Add other user properties as needed, e.g., email
  email?: string; // Assuming email might be part of the user data
}

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setError("No authentication token found.");
          setLoading(false);
          return;
        }
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setCurrentUser(response.data);
      } catch (err) {
        console.error("Error fetching current user:", err);
        setError("Failed to load user information.");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { currentUser, loading, error };
};