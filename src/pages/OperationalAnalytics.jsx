import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { 
  TrendingUp, Clock, AlertCircle, CheckCircle, Calendar, 
  Activity, Package, DollarSign, Users, Target, Zap
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '../components/ui'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// API call
const fetchOperationalAnalytics = async (days = 30) => {
  const token = localStorage.getItem('auth_token')
  const response = await axios.get(`${API_URL}/api/analytics/operational-dashboard?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.data
}

export default function OperationalAnalytics() {
  const [timeRange, setTimeRange] = useState(30)
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['operational-analytics', timeRange],
    queryFn: () => fetchOperationalAnalytics(timeRange),
    refetchInterval: 300000, // Refresh every 5 minutes
  })

  if (isLoading) return <AnalyticsSkeleton />
  if (error) return <ErrorState error={error} />

  const { operational_efficiency, service_performance } = data

  // return()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Operational Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Capacity utilization and service performance insights
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === days
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* ========== OPERATIONAL EFFICIENCY SECTION ========== */}
      <div>
        <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          Operational Efficiency
        </h2>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Capacity Utilization"
            value={`${operational_efficiency.capacity_utilization.utilization_percentage}%`}
            icon={TrendingUp}
            color="blue"
            subtitle={operational_efficiency.capacity_utilization.status}
          />
          <MetricCard
            title="Average Idle Time"
            value={`${operational_efficiency.idle_time.average_gap_minutes} min`}
            icon={Clock}
            color="yellow"
            subtitle={`${operational_efficiency.idle_time.idle_percentage}% idle`}
          />
          <MetricCard
            title="Double Bookings"
            value={operational_efficiency.double_booking_risk.total_overlaps}
            icon={AlertCircle}
            color={operational_efficiency.double_booking_risk.total_overlaps > 0 ? 'red' : 'green'}
            subtitle={operational_efficiency.double_booking_risk.risk_level}
          />
          <MetricCard
            title="Duration Accuracy"
            value={`${operational_efficiency.duration_accuracy.average_accuracy}%`}
            icon={CheckCircle}
            color="green"
            subtitle="Avg accuracy"
          />
        </div>

        {/* Booking Density Heatmap */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Booking Density Heatmap
            </CardTitle>
            <p className="text-sm text-gray-500">Peak times: {operational_efficiency.booking_density.peak_day} at {operational_efficiency.booking_density.peak_hour}:00</p>
          </CardHeader>
          <CardContent>
            <BookingHeatmap data={operational_efficiency.booking_density.heatmap} />
          </CardContent>
        </Card>

        {/* Most Requested Time Slots */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Most Requested Time Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {operational_efficiency.popular_time_slots.slice(0, 5).map((slot) => (
                <div key={slot.time_slot} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-100 text-blue-800">#{slot.rank}</Badge>
                    <span className="font-medium">{slot.time_slot}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(slot.booking_count / operational_efficiency.popular_time_slots[0].booking_count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{slot.booking_count} bookings</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Idle Time Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Idle Time Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <StatRow label="Total Gaps" value={operational_efficiency.idle_time.total_gaps} />
                <StatRow label="Longest Gap" value={`${operational_efficiency.idle_time.longest_gap_minutes} min`} />
                <StatRow label="Shortest Gap" value={`${operational_efficiency.idle_time.shortest_gap_minutes} min`} />
                <StatRow label="Idle Percentage" value={`${operational_efficiency.idle_time.idle_percentage}%`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Capacity Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <StatRow label="Booked Hours" value={`${operational_efficiency.capacity_utilization.booked_hours}h`} />
                <StatRow label="Available Hours" value={`${operational_efficiency.capacity_utilization.available_hours}h`} />
                <StatRow label="Idle Hours" value={`${operational_efficiency.capacity_utilization.idle_hours}h`} />
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Utilization</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {operational_efficiency.capacity_utilization.utilization_percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        operational_efficiency.capacity_utilization.utilization_percentage > 80 
                          ? 'bg-green-600' 
                          : operational_efficiency.capacity_utilization.utilization_percentage > 60 
                          ? 'bg-blue-600' 
                          : 'bg-yellow-600'
                      }`}
                      style={{ width: `${operational_efficiency.capacity_utilization.utilization_percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========== SERVICE PERFORMANCE SECTION ========== */}
      <div className="pt-6 border-t">
        <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-2">
          <Package className="h-6 w-6 text-purple-600" />
          Service Performance
        </h2>

        {/* Service Popularity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Service Popularity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={service_performance.popularity}
                    dataKey="booking_count"
                    nameKey="service_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.service_name} (${entry.percentage}%)`}
                  >
                    {service_performance.popularity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Service Mix
              </CardTitle>
              <p className="text-sm text-gray-500">
                Balance: {service_performance.service_mix.balance_score}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {service_performance.service_mix.services.slice(0, 5).map((service) => (
                  <div key={service.service_name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{service.service_name}</span>
                      <span className="text-gray-600">{service.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${service.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Completion Rates */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Service Completion Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={service_performance.completion_rates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service_name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completion_rate" fill="#10b981" name="Completion Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Service Profitability */}
        {service_performance.profitability[0]?.message !== 'Price data not available' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Service Profitability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {service_performance.profitability.map((service) => (
                  <div key={service.service_name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{service.service_name}</p>
                      <p className="text-sm text-gray-600">{service.booking_count} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${service.total_revenue}</p>
                      <p className="text-sm text-gray-600">Avg: ${service.average_value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upselling Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Upselling Opportunities
            </CardTitle>
            <p className="text-sm text-gray-500">Customers using only one service</p>
          </CardHeader>
          <CardContent>
            {service_performance.upselling_opportunities.length > 0 ? (
              <div className="space-y-3">
                {service_performance.upselling_opportunities.map((opp, idx) => (
                  <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{opp.contact_name}</p>
                        <p className="text-sm text-gray-600">{opp.contact_email}</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {opp.booking_count} bookings
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 mb-1">
                        Currently uses: <span className="font-medium">{opp.current_service}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Suggest: <span className="font-medium text-purple-600">
                          {opp.suggested_services.join(', ')}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No upselling opportunities identified</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ========== HELPER COMPONENTS ==========

function MetricCard({ title, value, icon: Icon, color, subtitle }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">{value}</p>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}

function BookingHeatmap({ data }) {
  // Group by day and hour
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM to 8 PM

  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1)

  const getColor = (count) => {
    if (count === 0) return 'bg-gray-100'
    const intensity = Math.ceil((count / maxCount) * 5)
    const colors = [
      'bg-blue-100',
      'bg-blue-200',
      'bg-blue-300',
      'bg-blue-400',
      'bg-blue-500',
      'bg-blue-600'
    ]
    return colors[intensity] || colors[5]
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-1 mb-2">
          <div className="w-24" />
          {hours.map(hour => (
            <div key={hour} className="w-12 text-center text-xs text-gray-600">
              {hour}:00
            </div>
          ))}
        </div>
        {days.map(day => (
          <div key={day} className="flex gap-1 mb-1">
            <div className="w-24 text-sm font-medium text-gray-700 flex items-center">{day}</div>
            {hours.map(hour => {
              const cell = data.find(d => d.day === day && d.hour === hour)
              const count = cell?.count || 0
              return (
                <div
                  key={`${day}-${hour}`}
                  className={`w-12 h-12 rounded ${getColor(count)} flex items-center justify-center text-xs font-medium ${
                    count > 0 ? 'text-white' : 'text-gray-400'
                  }`}
                  title={`${day} ${hour}:00 - ${count} bookings`}
                >
                  {count > 0 ? count : ''}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
        <span>Less</span>
        <div className="flex gap-1">
          {['bg-gray-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600'].map((color, idx) => (
            <div key={idx} className={`w-4 h-4 rounded ${color}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-96" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load analytics</h3>
        <p className="text-gray-600">{error.message}</p>
      </div>
    </div>
  )
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1']