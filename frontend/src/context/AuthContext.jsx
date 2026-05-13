import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // { uid, email, name, role, subjectIds, studentId }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const { data } = await api.post("/auth/login", { idToken });
          localStorage.setItem("token", data.token);
          setUser(data);
        } catch {
          // token exchange failed — still set minimal user info
          setUser({ uid: fbUser.uid, email: fbUser.email, role: "student" });
        }
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(email, password) {
    const cred    = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await cred.user.getIdToken();
    const { data } = await api.post("/auth/login", { idToken });
    localStorage.setItem("token", data.token);
    setUser(data);
    return data;
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("token");
    setUser(null);
  }

  const isAdmin      = user?.role === "admin";
  const isInstructor = user?.role === "admin" || user?.role === "instructor";
  const isStudent    = user?.role === "student";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isInstructor, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
