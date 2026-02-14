import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, Clock, CheckCircle, Loader2, AlertCircle, 
  MapPin, DollarSign, ChevronLeft, ChevronRight, User, Mail, Phone
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export default function PublicBookingPage() {
  const { workspaceSlug } = useParams()
  const [workspace, setWorkspace] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Booking flow state
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bookingConfirmation, setBookingConfirmation] = useState(null)
  
  const [contactInfo, setContactInfo] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    notes: ''
  })

  useEffect(() => {
    fetchBookingData()
  }, [workspaceSlug])

  useEffect(() => {
    if (selectedService && selectedDate) {
      fetchAvailableSlots()
    }
  }, [selectedService, selectedDate])

  const fetchBookingData = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/public/bookings/${workspaceSlug}`
      )
      setWorkspace(response.data.workspace)
      setServices(response.data.services)
      setLoading(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Booking page not found')
      setLoading(false)
    }
  }

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true)
    setAvailableSlots([])
    setSelectedSlot(null)
    try {
      const response = await axios.get(
        `${API_URL}/public/bookings/${workspaceSlug}/availability/${selectedService.id}`,
        { params: { date: selectedDate } }
      )
      setAvailableSlots(response.data.slots || [])
    } catch (err) {
      console.error('Failed to fetch slots:', err)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const response = await axios.post(
        `${API_URL}/public/bookings/${workspaceSlug}/book`,
        {
          service_id: selectedService.id,
          start_time: selectedSlot.start_time,
          ...contactInfo
        }
      )
      setBookingConfirmation(response.data)
      setStep(4)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-semibold">Page Not Found</h2>
            <p className="mt-2 text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {workspace?.logo_url && (
            <img 
              src={workspace.logo_url} 
              alt={workspace.name}
              className="h-16 mx-auto mb-4 rounded-lg"
            />
          )}
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{workspace?.name}</h1>
          <p className="text-gray-600">Book your appointment online</p>
        </div>

        {/* Progress Steps */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    step >= s ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border-2 border-gray-300'
                  }`}>
                    {s}
                  </div>
                  {s < 3 && <div className={`h-1 w-16 transition-all ${step > s ? 'bg-primary' : 'bg-gray-300'}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-16 mt-3 text-sm font-medium">
              <span className={step >= 1 ? 'text-primary' : 'text-gray-500'}>Service</span>
              <span className={step >= 2 ? 'text-primary' : 'text-gray-500'}>Date & Time</span>
              <span className={step >= 3 ? 'text-primary' : 'text-gray-500'}>Your Info</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepOne
              services={services}
              selectedService={selectedService}
              onSelect={(service) => {
                setSelectedService(service)
                setStep(2)
              }}
            />
          )}

          {step === 2 && (
            <StepTwo
              selectedService={selectedService}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              availableSlots={availableSlots}
              loadingSlots={loadingSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot)
                setStep(3)
              }}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <StepThree
              contactInfo={contactInfo}
              setContactInfo={setContactInfo}
              selectedService={selectedService}
              selectedSlot={selectedSlot}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}

          {step === 4 && bookingConfirmation && (
            <StepFour 
              confirmation={bookingConfirmation}
              workspace={workspace}
            />
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-12">
          Powered by {workspace?.name}
        </p>
      </div>
    </div>
  )
}

// ========== STEP 1: SELECT SERVICE ==========
function StepOne({ services, selectedService, onSelect }) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-xl">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-2xl">Select a Service</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Choose what you'd like to book</p>
        </CardHeader>
        <CardContent className="p-6">
          {services.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="mt-4 text-gray-500">No services available at this time</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <button
                    onClick={() => onSelect(service)}
                    className={`w-full text-left p-6 rounded-xl border-2 transition-all hover:shadow-lg ${
                      selectedService?.id === service.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    <h3 className="font-bold text-lg mb-2">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-gray-600 mb-4">{service.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration_minutes} min</span>
                      </div>
                      {service.price && (
                        <div className="flex items-center gap-1 font-semibold text-primary">
                          <DollarSign className="h-4 w-4" />
                          <span>{service.price}</span>
                        </div>
                      )}
                    </div>
                    {service.location && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                        <MapPin className="h-3 w-3" />
                        <span>{service.location}</span>
                      </div>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ========== STEP 2: SELECT DATE & TIME ==========
function StepTwo({ 
  selectedService, 
  selectedDate, 
  setSelectedDate, 
  availableSlots, 
  loadingSlots, 
  selectedSlot,
  onSelectSlot, 
  onBack 
}) {
  // Get next 14 days
  const getNext14Days = () => {
    const days = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      days.push(date)
    }
    return days
  }

  const days = getNext14Days()

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-xl">
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Select Date & Time</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {selectedService?.name} • {selectedService?.duration_minutes} minutes
              </p>
            </div>
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Date Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Choose a Date</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {days.map((date) => {
                const dateStr = date.toISOString().split('T')[0]
                const isSelected = selectedDate === dateStr
                const isToday = date.toDateString() === new Date().toDateString()
                
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-white shadow-md'
                        : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-medium">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold mt-1">
                      {date.getDate()}
                    </div>
                    {isToday && !isSelected && (
                      <div className="text-xs text-primary mt-1">Today</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Slot Selection */}
          {selectedDate && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Choose a Time</Label>
              
              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="mt-4 text-gray-600">No available slots for this date</p>
                  <p className="text-sm text-gray-500 mt-1">Please try another date</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => onSelectSlot(slot)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedSlot?.start_time === slot.start_time
                          ? 'border-primary bg-primary text-white shadow-md'
                          : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {slot.display_time}
                      </div>
                      {slot.available_spots > 1 && (
                        <div className="text-xs mt-1 opacity-75">
                          {slot.available_spots} spots
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ========== STEP 3: CONTACT INFORMATION ==========
function StepThree({ 
  contactInfo, 
  setContactInfo, 
  selectedService, 
  selectedSlot, 
  onBack, 
  onSubmit, 
  submitting 
}) {
  const formatDateTime = (isoString) => {
    const date = new Date(isoString)
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
  }

  const { date, time } = selectedSlot ? formatDateTime(selectedSlot.start_time) : {}

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-xl">
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Your Information</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Almost done! Just a few details</p>
            </div>
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2">
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name *
                  </Label>
                  <Input
                    value={contactInfo.contact_name}
                    onChange={(e) => setContactInfo({ ...contactInfo, contact_name: e.target.value })}
                    placeholder="John Doe"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </Label>
                  <Input
                    type="email"
                    value={contactInfo.contact_email}
                    onChange={(e) => setContactInfo({ ...contactInfo, contact_email: e.target.value })}
                    placeholder="john@example.com"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    type="tel"
                    value={contactInfo.contact_phone}
                    onChange={(e) => setContactInfo({ ...contactInfo, contact_phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Notes (Optional)</Label>
                  <textarea
                    className="w-full mt-1 rounded-md border border-gray-300 p-3 focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={3}
                    value={contactInfo.notes}
                    onChange={(e) => setContactInfo({ ...contactInfo, notes: e.target.value })}
                    placeholder="Any special requests or information we should know..."
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming Booking...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </form>
            </div>

            {/* Booking Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 p-6 rounded-xl bg-gradient-to-br from-primary/10 to-blue-50 border border-primary/20">
                <h3 className="font-bold text-lg mb-4">Booking Summary</h3>
                
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Service</p>
                    <p className="font-semibold">{selectedService?.name}</p>
                  </div>

                  <div>
                    <p className="text-gray-600 mb-1">Date</p>
                    <p className="font-semibold">{date}</p>
                  </div>

                  <div>
                    <p className="text-gray-600 mb-1">Time</p>
                    <p className="font-semibold">{time}</p>
                  </div>

                  <div>
                    <p className="text-gray-600 mb-1">Duration</p>
                    <p className="font-semibold">{selectedService?.duration_minutes} minutes</p>
                  </div>

                  {selectedService?.price && (
                    <div className="pt-3 border-t border-primary/20">
                      <p className="text-gray-600 mb-1">Price</p>
                      <p className="font-bold text-lg text-primary">${selectedService.price}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ========== STEP 4: CONFIRMATION ==========
function StepFour({ confirmation, workspace }) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="shadow-2xl max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <div className="h-20 w-20 rounded-full bg-green-500 mx-auto flex items-center justify-center mb-6">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
          </motion.div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-8">
            You're all set! We've sent a confirmation email with all the details.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-lg mb-4">Appointment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-semibold">{confirmation.booking_details?.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date</span>
                <span className="font-semibold">{confirmation.booking_details?.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time</span>
                <span className="font-semibold">{confirmation.booking_details?.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="font-semibold">{confirmation.booking_details?.duration} minutes</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-600">Confirmation #</span>
                <span className="font-mono font-semibold">#{confirmation.booking_id}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Need to make changes? Contact us at{' '}
            <a href={`mailto:${workspace?.contact_email}`} className="text-primary hover:underline">
              {workspace?.contact_email}
            </a>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}