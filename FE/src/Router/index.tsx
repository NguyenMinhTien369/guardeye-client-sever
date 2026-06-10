import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { DashboardLayout } from "../components/DashboardLayout";
import { Landing } from "../Pages/Landing";
import { Login } from "../Pages/Login";
import { Register } from "../Pages/Register";
import { ForgotPassword } from "../Pages/ForgotPassword";
import { ResetPassword } from "../Pages/ResetPassword";
import { Dashboard } from "../Pages/Dashboard";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/" element={<Landing />} />

        {/* Auth routes — wrapped in AuthLayout */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Protected routes wrapped in DashboardLayout */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
