import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar as CalendarIcon, Clock, MapPin, Check } from 'lucide-react'
import { publicAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '../components/ui'
import { formatDate, formatTime } from '../lib/utils'
import { toast } from 'sonner'

export default function PublicBooking() {
  const { workspaceSlug } = useParams()
  const [step, setStep] = useState(1) // 1: Service, 2: Date/Time, 3: Contact Info, 4: Confirmation
  const [workspace, setWorkspace] = useState(null)
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '', notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadWorkspace()
    loadServices()
  }, [workspaceSlug])

  useEffect(() => {
    if (selectedService && selectedDate) {
      loadAvailability()
    }
  }, [selectedService, selectedDate])

  const loadWorkspace = async () => {
    try {
      const { data } = await publicAPI.getWorkspace(workspaceSlug)
      setWorkspace(data)
    } catch (error) {
      toast.error('Workspace not found')
    }
  }

  const loadServices = async () => {
    try {
      const { data } = await publicAPI.getServices(workspaceSlug)
      setServices(data)
    } catch (error) {
      toast.error('Failed to load services')
    }
  }

  const loadAvailability = async () => {
    try {
      const { data } = await publicAPI.getAvailability(workspaceSlug, selectedService.id, selectedDate)
      setAvailableSlots(data.available_slots || [])
    } catch (error) {
      toast.error('Failed to load availability')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await publicAPI.createBooking(workspaceSlug, {
        service_id: selectedService.id,
        start_time: selectedSlot,
        contact_name: contactInfo.name,
        contact_email: contactInfo.email,
        contact_phone: contactInfo.phone,
        notes: contactInfo.notes,
      })
      setStep(4)
      toast.success('Booking confirmed!')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold gradient-text">{workspace?.name || 'Book Appointment'}</h1>
          <p className="text-gray-600 mt-2">Schedule your appointment in just a few clicks</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && <div className={`h-1 w-12 ${step > s ? 'bg-primary' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <Card className="shadow-xl">
          <CardContent className="p-8">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-2xl font-serif font-bold mb-6">Select Service</h2>
                <div className="space-y-3">
                  {services.map((service) => (
                    <motion.div
                      key={service.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setSelectedService(service)
                        setStep(2)
                      }}
                      className="p-4 border rounded-lg cursor-pointer hover:border-primary hover:shadow-md transition-all"
                    >
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{service.duration_minutes} min</span>
                        </div>
                        {service.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{service.location}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-2xl font-serif font-bold mb-6">Select Date & Time</h2>
                <div className="space-y-6">
                  <div>
                    <Label>Select Date</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {availableSlots.length > 0 && (
                    <div>
                      <Label>Available Times</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.start_time}
                            onClick={() => {
                              setSelectedSlot(slot.start_time)
                              setStep(3)
                            }}
                            className="p-3 border rounded-lg hover:border-primary hover:bg-primary/10 transition-all text-sm font-medium"
                          >
                            {formatTime(slot.start_time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDate && availableSlots.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No available slots for this date</p>
                  )}
                </div>

                <Button variant="outline" onClick={() => setStep(1)} className="mt-6">
                  Back
                </Button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-2xl font-serif font-bold mb-6">Your Information</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Full Name *</Label>
                    <Input
                      value={contactInfo.name}
                      onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Additional Notes</Label>
                    <textarea
                      className="w-full mt-1 rounded-md border p-2"
                      rows={3}
                      value={contactInfo.notes}
                      onChange={(e) => setContactInfo({...contactInfo, notes: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? 'Booking...' : 'Confirm Booking'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-serif font-bold mb-2">Booking Confirmed!</h2>
                <p className="text-gray-600 mb-6">
                  Your appointment for {selectedService?.name} on {formatDate(selectedSlot)} at {formatTime(selectedSlot)} has been confirmed.
                </p>
                <p className="text-sm text-gray-500">
                  A confirmation email has been sent to {contactInfo.email}
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Powered by <span className="font-semibold gradient-text">Unified Operations Platform</span>
        </p>
      </div>
    </div>
  )
}
