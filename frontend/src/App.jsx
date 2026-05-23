import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { AuthProvider }    from "./context/AuthContext";
import ProtectedRoute      from "./components/ProtectedRoute";
import Layout              from "./components/Layout";
import LoginPage           from "./pages/LoginPage";
import DashboardPage       from "./pages/DashboardPage";
import StudentsPage        from "./pages/StudentsPage";
import SubjectsPage        from "./pages/SubjectsPage";
import AttendancePage      from "./pages/AttendancePage";
import SessionsPage        from "./pages/SessionsPage";
import ReportsPage         from "./pages/ReportsPage";
import UsersPage           from "./pages/UsersPage";
import ProfilePage         from "./pages/ProfilePage";
import MarksPage           from "./pages/MarksPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background:   "#1e293b",
                color:        "#f1f5f9",
                border:       "1px solid #334155",
                borderRadius: "12px",
                fontSize:     "14px",
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* All authenticated users */}
              <Route index           element={<DashboardPage  />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="profile"    element={<ProfilePage   />} />

              {/* Instructors + Admin */}
              <Route path="students"
                element={<ProtectedRoute roles={["admin","instructor"]}><StudentsPage /></ProtectedRoute>} />
              <Route path="subjects"
                element={<ProtectedRoute roles={["admin","instructor"]}><SubjectsPage /></ProtectedRoute>} />
              <Route path="sessions"
                element={<ProtectedRoute roles={["admin","instructor"]}><SessionsPage /></ProtectedRoute>} />
              <Route path="reports"
                element={<ProtectedRoute roles={["admin","instructor"]}><ReportsPage  /></ProtectedRoute>} />
              <Route path="marks"
                element={<ProtectedRoute roles={["admin","instructor"]}><MarksPage    /></ProtectedRoute>} />

              {/* Admin only */}
              <Route path="users"
                element={<ProtectedRoute roles={["admin"]}><UsersPage /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
