import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/client";

type Role = "volunteer" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  organization?: string | null;
  responsibility?: string | null;
  role_template_id?: number | null;
  student_id?: string | null;
  vote_counter_opt_in?: boolean | null;
  role_template_can_edit_vote?: boolean | null;
  volunteer_tracks?: string[] | null;
  assigned_tracks?: string[] | null;
  organizations_detail?: { id: number; name: string; responsibility: string }[] | null;
}

interface AuthContextShape {
  user?: AuthUser | null;
  token?: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    apiClient("/api/auth/me", { token })
      .then((data) => setUser(data as AuthUser))
      .catch(() => setUser(null));
  }, [token]);

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await fetch(`${apiClient.baseURL}/api/auth/login`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error("登录失败");
    }
    const payload = await res.json();
    setToken(payload.access_token);
    localStorage.setItem("token", payload.access_token);
    const me = await apiClient("/api/auth/me", { token: payload.access_token });
    setUser(me as AuthUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  const value: AuthContextShape = {
    token,
    user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
