import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, Plus, Clock, User, MapPin, Filter, X, AlertCircle, Share2, Check, Search } from 'lucide-react'
import { bookingsAPI, servicesAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input, Label, Skeleton } from '../components/ui'
import { formatDate, formatTime, getStatusColor } from '../lib/utils'
import { toast } from 'sonner'

export default function Bookings() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedDate, setSelectedDate] = useState(null) // NEW: Selected date from calendar
  const [searchQuery, setSearchQuery] = useState('') // NEW: Search query
  const [selectedBooking, setSelectedBooking] = useState(null)
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', selectedStatus],
    queryFn: () => bookingsAPI.list({ 
      status: selectedStatus !== 'all' ? selectedStatus : undefined 
    }).then(res => res.data),
    refetchInterval: 3000
  })

  if (isLoading) return <BookingsSkeleton />

  // NEW: Filter by date and search query
  const filteredBookings = (bookings || []).filter(booking => {
    // Filter by selected date
    if (selectedDate) {
      const bookingDate = new Date(booking.start_time).toDateString()
      if (bookingDate !== selectedDate.toDateString()) {
        return false
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const contactName = booking.contact?.name?.toLowerCase() || ''
      const serviceName = booking.service?.name?.toLowerCase() || ''
      const contactEmail = booking.contact?.email?.toLowerCase() || ''
      
      return contactName.includes(query) || 
             serviceName.includes(query) || 
             contactEmail.includes(query)
    }

    return true
  })

  const groupedBookings = filteredBookings.reduce((acc, booking) => {
    const date = formatDate(booking.start_time)
    if (!acc[date]) acc[date] = []
    acc[date].push(booking)
    return acc
  }, {})

  // NEW: Clear filters function
  const clearFilters = () => {
    setSelectedDate(null)
    setSearchQuery('')
    setSelectedStatus('all')
  }

  const hasActiveFilters = selectedDate || searchQuery.trim() || selectedStatus !== 'all'

  function ShareBookingLinkButton() {
    const [copied, setCopied] = useState(false)
    const authUser = JSON.parse(localStorage.getItem('auth_user') || '{}')
    const workspaceSlug = authUser?.workspace_id || 'demo'
    
    const publicUrl = `${window.location.origin}/book/${workspaceSlug}`

    const copyToClipboard = () => {
      navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success('Booking link copied!')
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <Button variant="outline" onClick={copyToClipboard}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
        {copied ? 'Copied!' : 'Share Booking Link'}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage appointments and availability</p>
        </div>
        <div className="flex gap-2">
          <ShareBookingLinkButton />
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings List - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Card */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Search Bar - NEW */}
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-4">
                <Filter className="h-5 w-5 text-gray-400" />
                <div className="flex gap-2 flex-wrap">
                  {['all', 'pending', 'confirmed', 'completed', 'no_show'].map((status) => (
                    <Button
                      key={status}
                      variant={selectedStatus === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedStatus(status)}
                    >
                      {status.replace('_', ' ').toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Active Filters Display - NEW */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  <div className="flex gap-2 flex-wrap flex-1">
                    {selectedDate && (
                      <Badge 
                        variant="secondary" 
                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-200"
                        onClick={() => setSelectedDate(null)}
                      >
                        <Calendar className="h-3 w-3" />
                        {formatDate(selectedDate)}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {searchQuery && (
                      <Badge 
                        variant="secondary" 
                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-200"
                        onClick={() => setSearchQuery('')}
                      >
                        <Search className="h-3 w-3" />
                        "{searchQuery}"
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {selectedStatus !== 'all' && (
                      <Badge 
                        variant="secondary" 
                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-200"
                        onClick={() => setSelectedStatus('all')}
                      >
                        Status: {selectedStatus}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Count - NEW */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between px-4">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold">{filteredBookings.length}</span> booking{filteredBookings.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Bookings List */}
          <div className="space-y-6">
            {Object.keys(groupedBookings).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {hasActiveFilters ? 'No bookings match your filters' : 'No bookings found'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {hasActiveFilters 
                      ? 'Try adjusting your filters or search query' 
                      : 'Create your first booking to get started'}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedBookings).map(([date, dateBookings]) => (
                <motion.div key={date} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="text-xl font-serif font-semibold mb-3">{date}</h2>
                  <div className="space-y-3">
                    {dateBookings.map((booking, index) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        index={index}
                        onClick={() => setSelectedBooking(booking)}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Calendar - 1 column */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle>Calendar</CardTitle>
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(null)}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <BookingCalendar 
                bookings={bookings || []} 
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateBookingModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['bookings'])
            setShowCreateModal(false)
          }}
        />
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={() => queryClient.invalidateQueries(['bookings'])}
        />
      )}
    </div>
  )
}

// BookingCard with search highlighting - rest of the component code remains the same
function BookingCard({ booking, index, onClick, searchQuery }) {
  const highlightText = (text, query) => {
    if (!query || !text) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 px-0.5">{part}</mark>
        : part
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={onClick}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {highlightText(booking.contact?.name || 'Contact', searchQuery)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {highlightText(booking.service?.name || 'Service', searchQuery)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
                </div>
                {booking.service?.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{booking.service.location}</span>
                  </div>
                )}
              </div>
              
              {searchQuery && booking.contact?.email && (
                <p className="text-xs text-gray-500 mt-2">
                  {highlightText(booking.contact.email, searchQuery)}
                </p>
              )}
            </div>

            <Badge className={getStatusColor(booking.status)}>
              {booking.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Rest of components (CreateBookingModal, BookingDetailsModal) remain exactly the same...
// Enhanced Calendar with date selection
function BookingCalendar({ bookings, selectedDate, onDateSelect }) {
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  const bookingsByDate = bookings.reduce((acc, booking) => {
    const date = new Date(booking.start_time)
    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      const day = date.getDate()
      acc[day] = (acc[day] || 0) + 1
    }
    return acc
  }, {})
  
  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-12" />)
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day)
    const isToday = day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear()
    const isSelected = selectedDate && 
      day === selectedDate.getDate() && 
      currentMonth === selectedDate.getMonth() && 
      currentYear === selectedDate.getFullYear()
    const bookingCount = bookingsByDate[day] || 0
    
    days.push(
      <button
        key={day}
        onClick={() => onDateSelect(date)}
        className={`h-12 flex flex-col items-center justify-center text-sm rounded-lg transition-all relative cursor-pointer ${
          isSelected
            ? 'bg-primary text-white font-bold shadow-lg ring-2 ring-primary ring-offset-2'
            : isToday 
            ? 'bg-primary/20 text-primary font-bold' 
            : bookingCount > 0
            ? 'bg-blue-100 text-blue-900 font-medium hover:bg-blue-200'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <span>{day}</span>
        {bookingCount > 0 && !isSelected && (
          <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-blue-600'}`}>
            {bookingCount}
          </span>
        )}
        {bookingCount > 0 && isSelected && (
          <span className="text-xs text-white/90 font-semibold">{bookingCount}</span>
        )}
      </button>
    )
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            if (currentMonth === 0) {
              setCurrentMonth(11)
              setCurrentYear(currentYear - 1)
            } else {
              setCurrentMonth(currentMonth - 1)
            }
          }}
          className="text-gray-600 hover:text-gray-900 p-2"
        >
          ‹
        </button>
        <p className="font-semibold">{monthName}</p>
        <button
          onClick={() => {
            if (currentMonth === 11) {
              setCurrentMonth(0)
              setCurrentYear(currentYear + 1)
            } else {
              setCurrentMonth(currentMonth + 1)
            }
          }}
          className="text-gray-600 hover:text-gray-900 p-2"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-500 font-medium h-8 flex items-center justify-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>
    </div>
  )
}

// Keep all other components exactly as they were...
function CreateBookingModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    service_id: '',
    date: '',
    time: '',
    notes: ''
  })

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesAPI.list().then(res => res.data),
  })

  const mutation = useMutation({
    mutationFn: async (data) => {
      const bookingData = {
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        service_id: parseInt(data.service_id),
        start_time: `${data.date}T${data.time}:00`,
        notes: data.notes
      }
      return bookingsAPI.create(bookingData)
    },
    onSuccess: () => {
      toast.success('Booking created successfully')
      onSuccess()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create booking')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-serif font-bold">Create New Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="font-semibold mb-3">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Appointment Details</h3>
            <div className="space-y-4">
              <div>
                <Label>Service *</Label>
                <select
                  className="w-full mt-1 rounded-md border border-gray-300 p-2"
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  required
                >
                  <option value="">Select service</option>
                  {services?.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <textarea
                  className="w-full mt-1 rounded-md border border-gray-300 p-2"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special requirements or notes..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create Booking'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function BookingDetailsModal({ booking, onClose, onUpdate }) {
  const queryClient = useQueryClient()
  
  const updateMutation = useMutation({
    mutationFn: (data) => bookingsAPI.update(booking.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      toast.success('Booking updated')
      onUpdate()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-serif font-bold">Booking Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-500">Customer</Label>
            <p className="font-semibold">{booking.contact?.name}</p>
            {booking.contact?.email && <p className="text-sm text-gray-600">{booking.contact.email}</p>}
            {booking.contact?.phone && <p className="text-sm text-gray-600">{booking.contact.phone}</p>}
          </div>

          <div>
            <Label className="text-gray-500">Service</Label>
            <p className="font-semibold">{booking.service?.name}</p>
            {booking.service?.location && <p className="text-sm text-gray-600">{booking.service.location}</p>}
          </div>

          <div>
            <Label className="text-gray-500">Date & Time</Label>
            <p className="font-semibold">{formatDate(booking.start_time)}</p>
            <p className="text-sm text-gray-600">
              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
            </p>
          </div>

          {booking.notes && (
            <div>
              <Label className="text-gray-500">Notes</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">{booking.notes}</p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-gray-500">Status</Label>
            <div className="mt-2 flex gap-2 flex-wrap">
              {['pending', 'confirmed', 'completed', 'no_show', 'cancelled'].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={booking.status === status ? 'default' : 'outline'}
                  onClick={() => updateMutation.mutate({ status })}
                  disabled={updateMutation.isPending}
                >
                  {status.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </div>
  )
}

function BookingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardContent className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}