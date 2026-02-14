import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, Clock, User, Mail, Phone, MapPin, FileText, Image, 
  CheckCircle, XCircle, Ban, ChevronRight, AlertCircle, Download,
  History, BarChart3, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react'
import { bookingsAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '../components/ui'
import { formatDate, formatTime, getStatusColor, getInitials } from '../lib/utils'
import { toast } from 'sonner'

export default function TodaysBooking() {
  const [selectedBooking, setSelectedBooking] = useState(null)
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['todays-bookings-detailed'],
    queryFn: () => bookingsAPI.getTodayDetailed().then(res => res.data),
    refetchInterval: 30000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => bookingsAPI.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['todays-bookings-detailed'])
      toast.success('Booking status updated')
    },
  })

  if (isLoading) return <TodaysBookingSkeleton />

  const todaysBookings = bookings || []
  const now = new Date()

  const pastBookings = todaysBookings.filter(b => new Date(b.start_time) < now)
  const upcomingBookings = todaysBookings.filter(b => new Date(b.start_time) >= now)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold flex items-center gap-3">
            <Calendar className="h-10 w-10 text-primary" />
            Today's Appointments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {formatDate(now)} • {todaysBookings.length} {todaysBookings.length === 1 ? 'appointment' : 'appointments'}
          </p>
        </div>
        <div className="text-right">
          <Badge className="text-lg px-6 py-3 bg-primary text-white">
            {upcomingBookings.length} Upcoming
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings List - Left Side */}
        <div className="lg:col-span-1 space-y-4">
          {todaysBookings.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto h-16 w-16 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">No appointments today</h3>
                <p className="mt-2 text-sm text-gray-500">Enjoy your day off!</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Upcoming Appointments */}
              {upcomingBookings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase">
                    Upcoming ({upcomingBookings.length})
                  </h3>
                  <div className="space-y-2">
                    {upcomingBookings.map((booking, index) => (
                      <BookingListItem
                        key={booking.booking_id}
                        booking={booking}
                        isSelected={selectedBooking?.booking_id === booking.booking_id}
                        isUpcoming={true}
                        onClick={() => setSelectedBooking(booking)}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Appointments */}
              {pastBookings.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase">
                    Earlier Today ({pastBookings.length})
                  </h3>
                  <div className="space-y-2">
                    {pastBookings.map((booking, index) => (
                      <BookingListItem
                        key={booking.booking_id}
                        booking={booking}
                        isSelected={selectedBooking?.booking_id === booking.booking_id}
                        isUpcoming={false}
                        onClick={() => setSelectedBooking(booking)}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail View - Right Side */}
        <div className="lg:col-span-2">
          {selectedBooking ? (
            <BookingDetailView
              booking={selectedBooking}
              onUpdateStatus={(status) => {
                updateMutation.mutate({ id: selectedBooking.booking_id, status })
              }}
              isUpdating={updateMutation.isPending}
            />
          ) : (
            <Card className="h-full flex items-center justify-center border-2 border-dashed">
              <CardContent className="p-12 text-center">
                <ChevronRight className="mx-auto h-16 w-16 text-gray-400" />
                <p className="mt-4 text-lg text-gray-500">
                  Select an appointment to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function BookingListItem({ booking, isSelected, isUpcoming, onClick, index }) {
  const statusColors = {
    pending: 'bg-yellow-100 border-yellow-300',
    confirmed: 'bg-green-100 border-green-300',
    completed: 'bg-blue-100 border-blue-300',
    no_show: 'bg-red-100 border-red-300',
    cancelled: 'bg-gray-100 border-gray-300',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={`cursor-pointer transition-all ${
          isSelected 
            ? 'border-2 border-primary shadow-lg' 
            : isUpcoming
            ? 'border-2 border-blue-300 hover:border-blue-400'
            : 'border hover:border-gray-300'
        } ${statusColors[booking.status] || ''}`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold ${
              isUpcoming ? 'bg-blue-600' : 'bg-gray-600'
            }`}>
              {getInitials(booking.contact.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{booking.contact.name}</p>
              <p className="text-xs text-gray-600 truncate">{booking.service.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs font-medium">{formatTime(booking.start_time)}</span>
                <Badge className={`text-xs ${getStatusColor(booking.status)}`}>
                  {booking.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <ChevronRight className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function BookingDetailView({ booking, onUpdateStatus, isUpdating }) {
  const [expandedSections, setExpandedSections] = useState(['customer-bio'])
  
  const toggleSection = (section) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  // Check if bio data exists
  const hasBioData = booking.combined_bio_data && Object.keys(booking.combined_bio_data).length > 0
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Customer Info Card */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-blue-50 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold">
                {getInitials(booking.contact.name)}
              </div>
              <div>
                <CardTitle className="text-2xl">{booking.contact.name}</CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  {booking.contact.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <span>{booking.contact.email}</span>
                    </div>
                  )}
                  {booking.contact.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <span>{booking.contact.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Badge className={`text-lg px-4 py-2 ${getStatusColor(booking.status)}`}>
              {booking.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Appointment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">SERVICE</p>
              <p className="font-semibold text-lg">{booking.service.name}</p>
              <p className="text-sm text-gray-600">
                {booking.service.duration} minutes
                {booking.service.price && ` • $${booking.service.price}`}
              </p>
              {booking.service.location && (
                <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{booking.service.location}</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">TIME</p>
              <p className="font-semibold text-lg">
                {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
              </p>
              <p className="text-sm text-gray-600">
                Duration: {booking.service.duration} minutes
              </p>
            </div>
          </div>

          {/* Booking Notes */}
          {booking.notes && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-600 mb-2">BOOKING NOTES</p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">{booking.notes}</p>
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="border-t pt-6">
            <p className="text-xs font-semibold text-gray-600 mb-3">UPDATE STATUS</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                onClick={() => onUpdateStatus('confirmed')}
                disabled={isUpdating || booking.status === 'confirmed'}
                variant={booking.status === 'confirmed' ? 'default' : 'outline'}
                size="sm"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Confirmed
              </Button>
              <Button
                onClick={() => onUpdateStatus('completed')}
                disabled={isUpdating || booking.status === 'completed'}
                variant={booking.status === 'completed' ? 'default' : 'outline'}
                size="sm"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Completed
              </Button>
              <Button
                onClick={() => onUpdateStatus('no_show')}
                disabled={isUpdating || booking.status === 'no_show'}
                variant={booking.status === 'no_show' ? 'default' : 'outline'}
                size="sm"
              >
                <XCircle className="mr-1 h-4 w-4" />
                No Show
              </Button>
              <Button
                onClick={() => onUpdateStatus('cancelled')}
                disabled={isUpdating || booking.status === 'cancelled'}
                variant={booking.status === 'cancelled' ? 'default' : 'outline'}
                size="sm"
              >
                <Ban className="mr-1 h-4 w-4" />
                Cancelled
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Bio Data - NEW IMPROVED VERSION */}
      {hasBioData ? (
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardHeader 
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => toggleSection('customer-bio')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Customer Bio Data</CardTitle>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Collected from {Object.keys(booking.combined_bio_data).length} form{Object.keys(booking.combined_bio_data).length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {expandedSections.includes('customer-bio') ? 
                <ChevronUp className="h-5 w-5 text-gray-600" /> : 
                <ChevronDown className="h-5 w-5 text-gray-600" />
              }
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.includes('customer-bio') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6 bg-white">
                  <div className="space-y-6">
                    {Object.entries(booking.combined_bio_data).map(([formName, formData], idx) => (
                      <motion.div 
                        key={formName}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="relative"
                      >
                        {/* Form Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-blue-200">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <h4 className="font-bold text-lg text-blue-900">{formName}</h4>
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              {formData.form_type}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(formData.submitted_at)}
                          </span>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {formData.fields.map((field, fieldIdx) => (
                            <motion.div 
                              key={fieldIdx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: (idx * 0.1) + (fieldIdx * 0.05) }}
                              className="group"
                            >
                              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-all hover:shadow-md">
                                <div className="flex items-start justify-between mb-2">
                                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                                    {field.label}
                                  </p>
                                  {field.value && (
                                    <div className="h-2 w-2 rounded-full bg-green-500" title="Has value" />
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-gray-900 break-words">
                                  {field.value ? (
                                    typeof field.value === 'object' ? (
                                      <span className="text-xs bg-gray-200 px-2 py-1 rounded font-mono">
                                        {JSON.stringify(field.value)}
                                      </span>
                                    ) : (
                                      field.value
                                    )
                                  ) : (
                                    <span className="text-gray-400 italic">Not provided</span>
                                  )}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ) : (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No form submissions from this customer yet</p>
          </CardContent>
        </Card>
      )}

      {/* Customer Statistics */}
      <Card>
        <CardHeader 
          className="bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => toggleSection('stats')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Customer Statistics
            </CardTitle>
            {expandedSections.includes('stats') ? 
              <ChevronUp className="h-5 w-5 text-gray-600" /> : 
              <ChevronDown className="h-5 w-5 text-gray-600" />
            }
          </div>
        </CardHeader>
        <AnimatePresence>
          {expandedSections.includes('stats') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">
                      {booking.customer_stats.total_bookings}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Total Bookings</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      {booking.customer_stats.completed_bookings}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {booking.customer_stats.completion_rate}%
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Success Rate</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600">
                      {booking.customer_stats.days_as_customer}d
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Customer Since</p>
                  </div>
                </div>
                {booking.customer_stats.no_show_count > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-800">
                      <strong>{booking.customer_stats.no_show_count}</strong> no-show{booking.customer_stats.no_show_count > 1 ? 's' : ''} recorded
                    </span>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Form Submissions Details */}
      {booking.form_submissions && booking.form_submissions.length > 0 && (
        <Card>
          <CardHeader 
            className="bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => toggleSection('forms')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Form Submissions ({booking.form_submissions.length})
              </CardTitle>
              {expandedSections.includes('forms') ? 
                <ChevronUp className="h-5 w-5 text-gray-600" /> : 
                <ChevronDown className="h-5 w-5 text-gray-600" />
              }
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.includes('forms') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {booking.form_submissions.map((submission) => (
                      <div key={submission.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold flex items-center gap-2">
                              {submission.form_name}
                              <Badge className="text-xs bg-gray-100 text-gray-700">
                                {submission.form_type}
                              </Badge>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Submitted {formatDate(submission.submitted_at)} at {formatTime(submission.submitted_at)}
                            </p>
                          </div>
                          <Badge className={submission.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {submission.status}
                          </Badge>
                        </div>

                        {/* Media Files */}
                        {submission.media_files && submission.media_files.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                              <Image className="h-3 w-3" />
                              UPLOADED FILES ({submission.media_files.length})
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {submission.media_files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200 hover:bg-blue-100 transition-colors">
                                  <div className="flex items-center gap-2 flex-1">
                                    <Image className="h-4 w-4 text-blue-600" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium truncate">{file.field_name}</p>
                                      <p className="text-xs text-gray-600 truncate">{file.value}</p>
                                    </div>
                                  </div>
                                  <Button size="sm" variant="ghost">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* Booking History */}
      {booking.booking_history && booking.booking_history.length > 0 && (
        <Card>
          <CardHeader 
            className="bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => toggleSection('history')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Previous Appointments ({booking.booking_history.length})
              </CardTitle>
              {expandedSections.includes('history') ? 
                <ChevronUp className="h-5 w-5 text-gray-600" /> : 
                <ChevronDown className="h-5 w-5 text-gray-600" />
              }
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.includes('history') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {booking.booking_history.map((history) => (
                      <div key={history.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:shadow-sm transition-shadow">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{history.service_name}</p>
                          <p className="text-xs text-gray-600">
                            {formatDate(history.start_time)} at {formatTime(history.start_time)}
                          </p>
                          {history.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">{history.notes}</p>
                          )}
                        </div>
                        <Badge className={getStatusColor(history.status)}>
                          {history.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
    </motion.div>
  )
}

function TodaysBookingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-96" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  )
}