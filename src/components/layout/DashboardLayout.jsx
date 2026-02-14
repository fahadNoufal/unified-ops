import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Calendar, Inbox, FileText, Package, Users,
  Settings, LogOut, Menu, X, UserPlus, BarChart3
} from 'lucide-react'

// Make sure this path is correct based on your project structure
import logo from '../../logo/one-flow-logo.png'

import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Todays Booking', href: '/todays-booking', icon: Calendar },
  { name: 'Bookings', href: '/bookings', icon: Calendar },
  { name: 'Leads', href: '/leads', icon: UserPlus },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Forms', href: '/forms', icon: FileText },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Staff', href: '/staff', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Safe parsing of user object
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  // Shared Logo Component for consistency
  const LogoHeader = ({ textSize = "text-2xl" }) => (
    <div className="flex items-center">
      <img 
        src={logo} 
        alt="Unified Ops Logo" 
        className="h-8 w-auto mr-3 object-contain" 
      />
      <h1 className={`${textSize} font-serif font-bold gradient-text text-gray-900`}>
        Unified Ops
      </h1>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 relative">

      {/* ================= DESKTOP SIDEBAR ================= */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:z-30">
        <div className="flex flex-col flex-grow border-r border-gray-200 bg-white">
          
          {/* Desktop Logo Area */}
          <div className="flex items-center px-6 py-6 border-b h-20">
            <LogoHeader textSize="text-xl" />
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-primary text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 flex-shrink-0
                    ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
                  `} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Profile Footer */}
          <div className="border-t p-4 bg-gray-50/50">
            <div className="flex items-center w-full">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.full_name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.role || 'Admin'}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MOBILE SIDEBAR OVERLAY ================= */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">

            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Mobile Sidebar Header */}
              <div className="flex items-center justify-between px-6 py-6 border-b">
                <LogoHeader textSize="text-lg" />
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <item.icon className={`mr-3 h-5 w-5
                        ${isActive ? 'text-white' : 'text-gray-400'}
                      `} />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile User Footer */}
              <div className="border-t p-4 bg-gray-50">
                <div className="flex items-center mb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="lg:pl-64 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Mobile Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-md hover:bg-gray-100 text-gray-600"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Center Logo on Mobile Header */}
            <div className="flex items-center">
               <img src={logo} alt="Logo" className="h-6 w-auto mr-2" />
               <span className="text-lg font-serif font-bold text-gray-900">Unified Ops</span>
            </div>
            
            {/* Spacer for centering */}
            <div className="w-8" /> 
          </div>
        </div>

        <main className="flex-1">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}