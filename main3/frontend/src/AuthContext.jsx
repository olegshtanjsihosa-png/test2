import { useEffect, useState } from "react";
import { AuthContext } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch(`${API_BASE}/auth/user/`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          setUser(null);
        } else {
          const data = await response.json();
          if (data.is_authenticated) {
            setUser(data);
          } else {
            setUser(null);
          }
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCurrentUser();
  }, []);

  const login = async (username, password) => {
    setError(null);
    const response = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.detail || "ошибка входа");
      return null;
    }

    setUser(data);
    return data;
  };

  const register = async (username, password, email) => {
    setError(null);
    const response = await fetch(`${API_BASE}/auth/register/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, email }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.detail || "ошибка регистрации");
      return null;
    }

    setUser(data);
    return data;
  };

  const logout = async () => {
    setError(null);
    try {
      await fetch(`${API_BASE}/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}
