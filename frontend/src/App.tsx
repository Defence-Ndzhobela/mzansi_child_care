import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { ArrangementsPage } from './pages/parent/ArrangementsPage';
import { ChildrenPage } from './pages/parent/ChildrenPage';
import { ParentDashboard } from './pages/parent/ParentDashboard';
import { ParentPaymentHistoryPage } from './pages/parent/ParentPaymentHistoryPage';
import { ParentProfilePage } from './pages/parent/ParentProfilePage';
import { ParentReportsPage } from './pages/parent/ParentReportsPage';
import { PaymentsPage } from './pages/parent/PaymentsPage';
import { AboutPage } from './pages/public/AboutPage';
import { ContactPage } from './pages/public/ContactPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { AssignedFamiliesPage } from './pages/social-worker/AssignedFamiliesPage';
import { PaymentConcernsPage } from './pages/social-worker/PaymentConcernsPage';
import { SocialWorkerChildrenPage } from './pages/social-worker/SocialWorkerChildrenPage';
import { SocialWorkerDashboard } from './pages/social-worker/SocialWorkerDashboard';
import { SocialWorkerPaymentRecordsPage } from './pages/social-worker/SocialWorkerPaymentRecordsPage';
import { SocialWorkerProfilePage } from './pages/social-worker/SocialWorkerProfilePage';
import { SocialWorkerReportsPage } from './pages/social-worker/SocialWorkerReportsPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route
              path="/parent"
              element={
                <ProtectedRoute allowedRole="PARENT_CAREGIVER">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/parent/dashboard" replace />} />
              <Route path="dashboard" element={<ParentDashboard />} />
              <Route path="children" element={<ChildrenPage />} />
              <Route path="arrangements" element={<ArrangementsPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="history" element={<ParentPaymentHistoryPage />} />
              <Route path="reports" element={<ParentReportsPage />} />
              <Route path="profile" element={<ParentProfilePage />} />
            </Route>

            <Route
              path="/social-worker"
              element={
                <ProtectedRoute allowedRole="SOCIAL_WORKER">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/social-worker/dashboard" replace />} />
              <Route path="dashboard" element={<SocialWorkerDashboard />} />
              <Route path="families" element={<AssignedFamiliesPage />} />
              <Route path="children" element={<SocialWorkerChildrenPage />} />
              <Route path="payments" element={<SocialWorkerPaymentRecordsPage />} />
              <Route path="concerns" element={<PaymentConcernsPage />} />
              <Route path="reports" element={<SocialWorkerReportsPage />} />
              <Route path="profile" element={<SocialWorkerProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
