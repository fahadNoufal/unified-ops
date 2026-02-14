import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Calendar, FileText, TrendingUp,
  Users, Clock, AlertCircle, ChevronRight, Target, CheckCircle, Activity,
  Mail, Phone, Star, ArrowUp, Zap
} from 'lucide-react'
import { dashboardAPI } from '../services/api'
import { Card, CardContent, Badge } from '../components/ui'
import { formatTime, formatDate, getInitials } from '../lib/utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const [currentUser] = useState(JSON.parse(localStorage.getItem('auth_user') || '{}'))
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.get().then(res => res.data),
    refetchInterval: 3000,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => dashboardAPI.getAnalytics().then(res => res.data),
    refetchInterval: 3000,
  })

  const { data: liveLeads } = useQuery({
    queryKey: ['live-leads'],
    queryFn: () => dashboardAPI.getLiveLeads().then(res => res.data),
    refetchInterval: 3000,
  })

  if (isLoading || analyticsLoading) return <DashboardSkeleton />

  const todayBookings = data?.today_bookings || []
  const upcomingBookings = data?.upcoming_bookings || []

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back {currentUser.full_name?.split(' ')[0] || ''} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your business today</p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStatCard
          title="Today's Bookings"
          value={analytics?.today_bookings || 0}
          subtitle="appointments scheduled"
          icon={Calendar}
          color="bg-gradient-to-br from-orange-400 to-orange-500"
          lightColor="bg-orange-50"
          badge={`${analytics?.today_bookings_trend || 0}%`}
          badgeUp={analytics?.today_bookings_trend >= 0}
          onClick={() => navigate('/bookings')}
        />
        <QuickStatCard
          title="Active Leads"
          value={analytics?.active_leads_week || 0}
          subtitle="this week"
          icon={Users}
          color="bg-gradient-to-br from-blue-400 to-blue-500"
          lightColor="bg-blue-50"
          badge={`${analytics?.active_leads_week_trend || 0}%`}
          badgeUp={analytics?.active_leads_week_trend >= 0}
          onClick={() => navigate('/leads')}
        />
        <QuickStatCard
          title="Conversion Rate"
          value={`${analytics?.conversion_rate || 0}%`}
          subtitle="of leads converted"
          icon={Target}
          color="bg-gradient-to-br from-purple-400 to-purple-500"
          lightColor="bg-purple-50"
          badge={`${analytics?.conversion_rate_trend || 0}%`}
          badgeUp={analytics?.conversion_rate_trend >= 0}
          onClick={() => navigate('/leads')}
        />
        <QuickStatCard
          title="Pending Forms"
          value={analytics?.pending_forms || 0}
          subtitle="awaiting completion"
          icon={FileText}
          color="bg-gradient-to-br from-pink-400 to-pink-500"
          lightColor="bg-pink-50"
          badge={analytics?.overdue_forms > 0 ? `${analytics.overdue_forms} overdue` : 'On track'}
          badgeUp={analytics?.overdue_forms === 0}
          onClick={() => navigate('/forms')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Bookings Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Bookings Activity</h3>
                    <p className="text-sm text-gray-500">Weekly overview</p>
                  </div>
                  <button 
                    onClick={() => navigate('/bookings')}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <WeeklyBookingChart data={analytics?.seven_day_bookings || []} />
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 font-semibold">+{analytics?.today_bookings_trend || 0}%</span>
                  </div>
                  <span className="text-gray-500">Increase from last week</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Today's Schedule */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Today's Schedule</h3>
                    <p className="text-sm text-gray-500">{todayBookings.length} appointments</p>
                  </div>
                  <button 
                    onClick={() => navigate('/bookings')}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {todayBookings.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-3 text-sm text-gray-500">No appointments today</p>
                    </div>
                  ) : (
                    todayBookings.slice(0, 5).map((booking, index) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer"
                        onClick={() => navigate('/bookings')}
                      >
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {getInitials(booking.contact_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{booking.contact_name}</p>
                          <p className="text-sm text-gray-500 truncate">{booking.service_name}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900">{formatTime(booking.start_time)}</p>
                          <Badge className="bg-green-100 text-green-700 text-xs mt-1">
                            {booking.status || 'Confirmed'}
                          </Badge>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Live Leads */}
          {liveLeads && liveLeads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="shadow-lg border-0 overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <h3 className="text-lg font-bold text-gray-900">Live Leads</h3>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      {liveLeads.length} new
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {liveLeads.slice(0, 3).map((lead, index) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 * index }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white hover:shadow-md transition-all cursor-pointer"
                        onClick={() => navigate('/leads')}
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white font-semibold">
                          {getInitials(lead.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{lead.name}</p>
                          <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {lead.minutes_ago}m ago
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Column - 1 col */}
        <div className="space-y-6">
          
          {/* Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardContent className="p-6">
                <MiniCalendar bookings={upcomingBookings} onClick={() => navigate('/bookings')} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Assignments/Tasks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="space-y-3">
                  <ActionButton
                    icon={Calendar}
                    label="View Today's Bookings"
                    color="bg-blue-50"
                    iconColor="text-blue-600"
                    onClick={() => navigate('/bookings')}
                  />
                  <ActionButton
                    icon={Users}
                    label="Manage Leads"
                    color="bg-purple-50"
                    iconColor="text-purple-600"
                    onClick={() => navigate('/leads')}
                  />
                  <ActionButton
                    icon={FileText}
                    label="Review Forms"
                    color="bg-orange-50"
                    iconColor="text-orange-600"
                    onClick={() => navigate('/forms')}
                  />
                  <ActionButton
                    icon={Mail}
                    label="Check Messages"
                    color="bg-green-50"
                    iconColor="text-green-600"
                    onClick={() => navigate('/inbox')}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Performance Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="shadow-lg border-0 overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Star className="h-8 w-8 text-yellow-300" />
                  <Badge className="bg-white/20 text-white">This Month</Badge>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {analytics?.completion_rate || 0}%
                </h3>
                <p className="text-sm text-white/80 mb-4">Completion Rate</p>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${analytics?.completion_rate || 0}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 text-white/90 text-sm">
                  <ArrowUp className="h-4 w-4" />
                  <span>+{analytics?.completion_rate_trend || 0}% from last month</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Quick Stat Card
function QuickStatCard({ title, value, subtitle, icon: Icon, color, lightColor, badge, badgeUp, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="shadow-lg border-0 overflow-hidden hover:shadow-xl transition-all">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`h-12 w-12 rounded-2xl ${color} flex items-center justify-center shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            {badge && (
              <Badge className={`${badgeUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs`}>
                {badge}
              </Badge>
            )}
          </div>
          <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Weekly Booking Chart
function WeeklyBookingChart({ data }) {
  if (!data || data.length === 0) return null

  const maxValue = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="flex items-end justify-between gap-3 h-56">
      {data.map((day, index) => {
        const heightPercent = (day.count / maxValue) * 100

        return (
          <div key={index} className="flex-1 flex flex-col items-center">
            
            {/* Bar Container (IMPORTANT FIX) */}
            <div className="relative w-full h-40 flex items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPercent}%` }}
                transition={{
                  delay: index * 0.08,
                  duration: 0.6,
                  ease: "easeOut"
                }}
                className={`w-full rounded-t-2xl transition-all ${
                  day.is_today
                    ? 'bg-gradient-to-t from-primary to-blue-500 shadow-lg'
                    : 'bg-blue-200 hover:bg-blue-400'
                }`}
              />

              {/* Tooltip */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap">
                  {day.count}
                </div>
              </div>
            </div>

            {/* Label */}
            <p
              className={`mt-2 text-xs font-semibold ${
                day.is_today ? 'text-primary' : 'text-gray-600'
              }`}
            >
              {day.is_today ? 'Today' : day.day}
            </p>
          </div>
        )
      })}
    </div>
  )
}


// Mini Calendar
function MiniCalendar({ bookings, onClick }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const days = []
  const bookingDates = new Set(
    bookings.map(b => new Date(b.start_time).getDate())
  )
  
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-10" />)
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === now.getDate()
    const hasBooking = bookingDates.has(day)
    
    days.push(
      <div
        key={day}
        className={`h-10 flex items-center justify-center text-sm rounded-xl transition-all cursor-pointer font-medium ${
          isToday 
            ? 'bg-gradient-to-br from-primary to-blue-400 text-white shadow-lg scale-105' 
            : hasBooking
            ? 'bg-green-100 text-green-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        onClick={onClick}
      >
        {day}
      </div>
    )
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">{monthName}</h3>
        <div className="flex gap-1">
          <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-3">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-500 font-semibold">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days}
      </div>
    </div>
  )
}

// Action Button
function ActionButton({ icon: Icon, label, color, iconColor, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl ${color} hover:shadow-md transition-all`}
    >
      <div className={`h-10 w-10 rounded-xl bg-white flex items-center justify-center ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="font-medium text-gray-900 text-sm">{label}</span>
      <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
    </motion.button>
  )
}

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-gray-200 rounded-lg w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl" />
        <div className="h-96 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  )
}