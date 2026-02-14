import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Bookings from './pages/Bookings'
import Inbox from './pages/Inbox'
import Forms from './pages/Forms'
import Inventory from './pages/Inventory'
import Staff from './pages/Staff'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import PublicBooking from './pages/PublicBooking'
import PublicForm from './pages/PublicForm'
import PublicFormPage from './pages/PublicFormPage'
import Leads from './pages/Leads'
import PublicBookingPage from './pages/PublicBookingPage'
import TodaysBooking from './pages/TodaysBooking'
import OperationalAnalytics from './pages/OperationalAnalytics'
import PublicChat from './pages/PublicChat'
import EmailConnection from './pages/EmailConnection'

// Layout
import DashboardLayout from './components/layout/DashboardLayout'
import AuthLayout from './components/layout/AuthLayout'

function App() {
  return (
    <>
      <Routes>
        {/* Public Routes - No Authentication */}
        <Route path="/:workspaceSlug/book" element={<PublicBooking />} />
        <Route path="/public/forms/:workspaceSlug/:formId" element={<PublicFormPage />} />
        <Route path="/chat/:token" element={<PublicChat />} /> 
        <Route path="/book/:workspaceSlug" element={<PublicBookingPage />} />


        <Route path="/forms/:token" element={<PublicForm />} />

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected Routes - Require Authentication */}
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          
          <Route path="/settings/email-connection" element={<EmailConnection />} />
          
          
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<OperationalAnalytics />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/todays-booking" element={<TodaysBooking />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/inventory" element={<Inventory />} />
          
          <Route path="/staff" element={<Staff />} />
          <Route path="/settings" element={<Settings />} />
          
          
          
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  )
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token')
  
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default App
