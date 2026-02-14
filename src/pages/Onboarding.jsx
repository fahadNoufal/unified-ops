import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronRight, ChevronLeft, Loader2, Check, Sparkles, 
  Building, Bot, MessageCircle, Package, Mail, Calendar,
  Briefcase, FileText, MapPin, DollarSign, Users, Zap,
  ExternalLink, ChevronDown, ChevronUp, HelpCircle
} from 'lucide-react'
import { workspaceAPI, servicesAPI } from '../services/api'
import { Button, Input, Label, Card, CardContent } from '../components/ui'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, title: 'Welcome!', subtitle: "Let's get to know you", icon: Sparkles },
  { id: 2, title: 'AI Assistant', subtitle: 'Automate conversations', icon: Bot, optional: true },
  { id: 3, title: 'Email Setup', subtitle: 'Connect Resend', icon: Mail, optional: true },
  { id: 4, title: 'Contact Form', subtitle: 'Ready to go', icon: MessageCircle },
  { id: 5, title: 'First Service', subtitle: 'What you offer', icon: Briefcase },
  { id: 6, title: 'Availability', subtitle: 'Your hours', icon: Calendar },
  { id: 7, title: 'Inventory', subtitle: 'Track supplies', icon: Package, optional: true },
  { id: 8, title: 'Email Templates', subtitle: 'Auto-send emails', icon: Mail, optional: true },
  { id: 9, title: 'Demo Data', subtitle: 'Test with samples', icon: Users, optional: true },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: '',
    businessName: '',
    industry: '',
    businessAddress: '',
    contactEmail: '',
    contactPhone: '',
    
    // Step 2: AI Assistant
    enableAI: false,
    geminiApiKey: '',
    businessDescription: '',
    servicesAndPricing: '',
    bookingAndScheduling: '',
    policiesAndGuidelines: '',
    practicalInformation: '',
    
    // Step 3: Email
    emailApiKey: '',
    testEmail: '',
    
    // Step 5: Service
    serviceName: '',
    serviceDuration: 30,
    serviceLocation: '',
    
    // Step 6: Availability
    availability: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    },
    
    // Step 9: Demo Data
    generateDummyData: false,
  })

  // AI section expanded states
  const [expandedSections, setExpandedSections] = useState({
    description: true,
    services: false,
    booking: false,
    policies: false,
    practical: false
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Validation
  const validateStep = (step) => {
    const newErrors = {}
    
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Your name is required'
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required'
      if (!formData.industry.trim()) newErrors.industry = 'Please select an industry'
      if (!formData.contactEmail.trim()) newErrors.contactEmail = 'Contact email is required'
      else if (!/\S+@\S+\.\S+/.test(formData.contactEmail)) {
        newErrors.contactEmail = 'Please enter a valid email'
      }
    }
    
    if (step === 2 && formData.enableAI) {
      if (!formData.businessDescription.trim()) {
        newErrors.businessDescription = 'Please tell us about your business'
      }
    }
    
    if (step === 5) {
      if (!formData.serviceName.trim()) {
        newErrors.serviceName = 'Service name is required'
      }
      if (!formData.serviceDuration || formData.serviceDuration < 15) {
        newErrors.serviceDuration = 'Duration must be at least 15 minutes'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
        setErrors({})
      } else {
        handleComplete()
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setErrors({})
    }
  }

  const handleSkip = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
      setErrors({})
    }
  }

  const handleComplete = async () => {
    setIsSubmitting(true)
    
    try {
      // Combine AI answers into rag_content
      let ragContent = ''
      if (formData.enableAI) {
        ragContent = `
ABOUT THE BUSINESS:
${formData.businessDescription}

SERVICES & PRICING:
${formData.servicesAndPricing}

BOOKING & SCHEDULING:
${formData.bookingAndScheduling}

POLICIES & GUIDELINES:
${formData.policiesAndGuidelines}

PRACTICAL INFORMATION:
${formData.practicalInformation}
        `.trim()
      }
      
      // Prepare working hours from availability
      const workingHours = {}
      Object.entries(formData.availability).forEach(([day, config]) => {
        if (config.enabled) {
          workingHours[day] = {
            start: config.start,
            end: config.end
          }
        }
      })
      
      // Update workspace
      await workspaceAPI.update({
        name: formData.businessName,
        business_address: formData.businessAddress,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone,
        email_api_key: formData.emailApiKey || null,
        industry: formData.industry,
        rag_content: ragContent || null,
        gemini_api_key: formData.geminiApiKey || null,
        working_hours: workingHours,
      })
      
      // Create service if provided
      if (formData.serviceName) {
        await servicesAPI.create({
          name: formData.serviceName,
          duration_minutes: formData.serviceDuration,
          location: formData.serviceLocation,
        })
      }

      // Generate dummy data if requested
      if (formData.generateDummyData) {
        await workspaceAPI.generateDummyData()
      }

      // Activate workspace
      await workspaceAPI.activate()

      toast.success('🎉 Onboarding complete! Welcome aboard!')
      navigate('/dashboard')
    } catch (error) {
      console.error('Onboarding error:', error)
      toast.error('Failed to complete onboarding. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    idx + 1 === currentStep
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110'
                      : idx + 1 < currentStep
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                  animate={idx + 1 === currentStep ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {idx + 1 < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </motion.div>
                
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 rounded transition-all ${
                    idx + 1 < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Step {currentStep} of {STEPS.length}
              {STEPS[currentStep - 1].optional && ' (Optional)'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-xl">
              <CardContent className="p-8">
                
                {/* Step 1: Welcome & Basic Info */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.5 }}
                      >
                        <Sparkles className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                      </motion.div>
                      <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Welcome to Your Operations Platform! 🎉
                      </h1>
                      <p className="text-lg text-gray-600">
                        Let's get your business set up. This will only take a few minutes!
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>Your Name *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={errors.name ? 'border-red-500' : ''}
                          placeholder="John Doe"
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                      </div>

                      <div>
                        <Label>Business Name *</Label>
                        <Input
                          value={formData.businessName}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          className={errors.businessName ? 'border-red-500' : ''}
                          placeholder="Acme Spa & Wellness"
                        />
                        {errors.businessName && <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>}
                      </div>

                      <div>
                        <Label>Industry *</Label>
                        <select
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            errors.industry ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select your industry...</option>
                          <option value="spa">Spa & Wellness</option>
                          <option value="salon">Hair Salon & Beauty</option>
                          <option value="medical">Medical & Healthcare</option>
                          <option value="fitness">Fitness & Gym</option>
                          <option value="consulting">Consulting & Coaching</option>
                          <option value="therapy">Therapy & Counseling</option>
                          <option value="photography">Photography</option>
                          <option value="events">Events & Planning</option>
                          <option value="other">Other</option>
                        </select>
                        {errors.industry && <p className="mt-1 text-sm text-red-600">{errors.industry}</p>}
                      </div>

                      <div>
                        <Label>Business Address</Label>
                        <Input
                          value={formData.businessAddress}
                          onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                          placeholder="123 Main St, Suite 100, New York, NY 10001"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Contact Email *</Label>
                          <Input
                            type="email"
                            value={formData.contactEmail}
                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                            className={errors.contactEmail ? 'border-red-500' : ''}
                            placeholder="contact@yourbusiness.com"
                          />
                          {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
                        </div>
                        <div>
                          <Label>Contact Phone</Label>
                          <Input
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: AI Assistant */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <Bot className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                      </motion.div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        Meet Your AI Sales Assistant 🤖
                      </h2>
                      <p className="text-lg text-gray-600 mb-4">
                        Automatically respond to customer questions 24/7!
                      </p>
                    </div>

                    {/* Benefits */}
                    <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-6 mb-6">
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-600" />
                        What Your AI Assistant Does:
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <MessageCircle className="h-5 w-5 text-blue-600 mt-1" />
                          <div>
                            <p className="font-medium">Instant Responses</p>
                            <p className="text-sm text-gray-600">Answer questions about hours, pricing, services</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <DollarSign className="h-5 w-5 text-green-600 mt-1" />
                          <div>
                            <p className="font-medium">Drive Bookings</p>
                            <p className="text-sm text-gray-600">Motivate customers to book appointments</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-purple-600 mt-1" />
                          <div>
                            <p className="font-medium">24/7 Availability</p>
                            <p className="text-sm text-gray-600">Never miss a lead, even after hours</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Sparkles className="h-5 w-5 text-pink-600 mt-1" />
                          <div>
                            <p className="font-medium">Smart & Accurate</p>
                            <p className="text-sm text-gray-600">Learns from your business information</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white border-2 border-blue-200 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-900">Enable AI Assistant</p>
                        <p className="text-sm text-gray-600">Recommended for best results</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.enableAI}
                          onChange={(e) => setFormData({ ...formData, enableAI: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* AI Config (if enabled) */}
                    <AnimatePresence>
                      {formData.enableAI && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4"
                        >
                          {/* API Key */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <Label>Gemini API Key (Optional)</Label>
                            <Input
                              type="password"
                              value={formData.geminiApiKey}
                              onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                              placeholder="Leave empty to use system default"
                            />
                            <a
                              href="https://makersuite.google.com/app/apikey"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 mt-2 text-sm text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Get your free Gemini API key
                            </a>
                            <p className="text-xs text-gray-600 mt-2">
                              💡 Don't have one? No worries! We'll use our default key.
                            </p>
                          </div>

                          {/* Questions */}
                          <div className="space-y-3">
                            <p className="text-sm font-medium text-gray-700 mb-4">
                              📝 Tell us about your business so your AI can answer accurately:
                            </p>

                            {/* Q1: Business Description */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('description')}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-3">
                                  <Building className="h-5 w-5 text-blue-600" />
                                  <span className="font-medium">1. About Your Business *</span>
                                </div>
                                {expandedSections.description ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                              <AnimatePresence>
                                {expandedSections.description && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-4 bg-gray-50 border-t">
                                      <p className="text-sm text-gray-600 mb-3">
                                        Describe what you do, who you serve, what makes you unique, and the experience customers can expect.
                                      </p>
                                      <textarea
                                        value={formData.businessDescription}
                                        onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                                        rows={4}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none ${
                                          errors.businessDescription ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                        placeholder="We are a luxury spa offering relaxation and wellness services..."
                                      />
                                      {errors.businessDescription && (
                                        <p className="mt-1 text-sm text-red-600">{errors.businessDescription}</p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Q2: Services */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('services')}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-3">
                                  <Briefcase className="h-5 w-5 text-green-600" />
                                  <span className="font-medium">2. Services & Pricing</span>
                                </div>
                                {expandedSections.services ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                              <AnimatePresence>
                                {expandedSections.services && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                  >
                                    <div className="p-4 bg-gray-50 border-t">
                                      <p className="text-sm text-gray-600 mb-3">
                                        List all services with details: what's included, duration, pricing, and who it's for.
                                      </p>
                                      <textarea
                                        value={formData.servicesAndPricing}
                                        onChange={(e) => setFormData({ ...formData, servicesAndPricing: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="Full Body Massage: 60 min, $120..."
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Q3: Booking */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('booking')}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar className="h-5 w-5 text-purple-600" />
                                  <span className="font-medium">3. Booking & Scheduling Rules</span>
                                </div>
                                {expandedSections.booking ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                              <AnimatePresence>
                                {expandedSections.booking && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                  >
                                    <div className="p-4 bg-gray-50 border-t">
                                      <p className="text-sm text-gray-600 mb-3">
                                        Explain your hours, booking requirements, cancellation policy, and no-show rules.
                                      </p>
                                      <textarea
                                        value={formData.bookingAndScheduling}
                                        onChange={(e) => setFormData({ ...formData, bookingAndScheduling: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="Open Monday-Saturday 9am-7pm..."
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Q4: Policies */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('policies')}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-orange-600" />
                                  <span className="font-medium">4. Policies & Guidelines</span>
                                </div>
                                {expandedSections.policies ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                              <AnimatePresence>
                                {expandedSections.policies && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                  >
                                    <div className="p-4 bg-gray-50 border-t">
                                      <p className="text-sm text-gray-600 mb-3">
                                        Include refund policy, payment methods, safety standards, and important rules.
                                      </p>
                                      <textarea
                                        value={formData.policiesAndGuidelines}
                                        onChange={(e) => setFormData({ ...formData, policiesAndGuidelines: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="Full refund if canceled 24h+ in advance..."
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Q5: Practical */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleSection('practical')}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-3">
                                  <MapPin className="h-5 w-5 text-red-600" />
                                  <span className="font-medium">5. Practical Information</span>
                                </div>
                                {expandedSections.practical ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                              <AnimatePresence>
                                {expandedSections.practical && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                  >
                                    <div className="p-4 bg-gray-50 border-t">
                                      <p className="text-sm text-gray-600 mb-3">
                                        Share location, parking, contact info, FAQs, and special notes.
                                      </p>
                                      <textarea
                                        value={formData.practicalInformation}
                                        onChange={(e) => setFormData({ ...formData, practicalInformation: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="Located at 123 Main St..."
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                            <HelpCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-green-800">
                              <strong>Pro tip:</strong> The more details you provide, the better your AI can help! You can edit this later in Settings.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Step 3: Email Integration */}
                {currentStep === 3 && (
                  <Step3_Email formData={formData} setFormData={setFormData} />
                )}

                {/* Step 4: Contact Form */}
                {currentStep === 4 && <Step4_ContactForm />}

                {/* Step 5: Service */}
                {currentStep === 5 && (
                  <Step5_Service formData={formData} setFormData={setFormData} errors={errors} />
                )}

                {/* Step 6: Availability */}
                {currentStep === 6 && (
                  <Step6_Availability formData={formData} setFormData={setFormData} />
                )}

                {/* Step 7: Inventory */}
                {currentStep === 7 && <Step7_Inventory />}

                {/* Step 8: Email Templates */}
                {currentStep === 8 && <Step8_EmailTemplates />}

                {/* Step 9: Demo Data */}
                {currentStep === 9 && (
                  <Step9_DemoData formData={formData} setFormData={setFormData} />
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <div className="flex items-center gap-3">
                    {STEPS[currentStep - 1].optional && (
                      <Button
                        variant="ghost"
                        onClick={handleSkip}
                      >
                        Skip for now
                      </Button>
                    )}
                    
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Setting up...
                          </>
                        ) : currentStep === STEPS.length ? (
                          <>
                            Complete Setup
                            <Sparkles className="ml-2 h-4 w-4" />
                          </>
                        ) : (
                          <>
                            Continue
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// Step Components
function Step3_Email({ formData, setFormData }) {
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    try {
      await workspaceAPI.testEmail(formData.testEmail)
      toast.success('Test email sent successfully!')
    } catch (error) {
      toast.error('Failed to send test email')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Mail className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Email Integration 📧
        </h2>
        <p className="text-lg text-gray-600">
          Connect Resend for automated emails
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          What Email Automation Does:
        </h3>
        <div className="space-y-3 text-gray-700">
          <p className="flex items-start gap-2">
            <Check className="h-5 w-5 text-blue-600 mt-0.5" />
            <span>Welcome emails sent automatically</span>
          </p>
          <p className="flex items-start gap-2">
            <Check className="h-5 w-5 text-blue-600 mt-0.5" />
            <span>Booking confirmations with details</span>
          </p>
          <p className="flex items-start gap-2">
            <Check className="h-5 w-5 text-blue-600 mt-0.5" />
            <span>Automated reminders to reduce no-shows</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 border rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Optional:</strong> Add your Resend API key now or later in Settings. Without it, emails will be logged instead of sent.
          </p>
        </div>
        
        <div>
          <Label>Resend API Key</Label>
          <Input
            value={formData.emailApiKey}
            onChange={(e) => setFormData({ ...formData, emailApiKey: e.target.value })}
            placeholder="re_xxxxxxxxxxxxxxxx"
          />
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from{' '}
            <a href="https://resend.com/api-keys" target="_blank" className="text-blue-600 underline">
              resend.com
            </a>
          </p>
        </div>

        {formData.emailApiKey && (
          <div>
            <Label>Test Email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={formData.testEmail}
                onChange={(e) => setFormData({ ...formData, testEmail: e.target.value })}
                placeholder="your@email.com"
              />
              <Button onClick={handleTest} disabled={testing || !formData.testEmail}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Step4_ContactForm() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <MessageCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Contact Form Ready! ✅
        </h2>
        <p className="text-lg text-gray-600">
          A default contact form will be created automatically
        </p>
      </div>
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Check className="h-6 w-6 text-green-600 mt-1" />
          <div>
            <h3 className="font-semibold text-green-900">Default Contact Form</h3>
            <p className="text-sm text-green-800 mt-1">
              We'll create a standard contact form with name, email, phone, and message fields.
              You can customize it later in the Forms section.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step5_Service({ formData, setFormData, errors }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Briefcase className="h-16 w-16 text-purple-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Create Your First Service 💼
        </h2>
        <p className="text-lg text-gray-600">
          What do you offer to your clients?
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <Label>Service Name *</Label>
          <Input
            value={formData.serviceName}
            onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
            className={errors.serviceName ? 'border-red-500' : ''}
            placeholder="e.g., Consultation, Massage, Facial"
          />
          {errors.serviceName && <p className="mt-1 text-sm text-red-600">{errors.serviceName}</p>}
        </div>
        <div>
          <Label>Duration (minutes) *</Label>
          <Input
            type="number"
            value={formData.serviceDuration}
            onChange={(e) => setFormData({ ...formData, serviceDuration: parseInt(e.target.value) })}
            className={errors.serviceDuration ? 'border-red-500' : ''}
            min="15"
            step="15"
          />
          {errors.serviceDuration && <p className="mt-1 text-sm text-red-600">{errors.serviceDuration}</p>}
        </div>
        <div>
          <Label>Location</Label>
          <Input
            value={formData.serviceLocation}
            onChange={(e) => setFormData({ ...formData, serviceLocation: e.target.value })}
            placeholder="123 Main St, Suite 100"
          />
        </div>
      </div>
    </div>
  )
}

function Step6_Availability({ formData, setFormData }) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Calendar className="h-16 w-16 text-orange-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Set Your Availability 📅
        </h2>
        <p className="text-lg text-gray-600">
          When are you available for bookings?
        </p>
      </div>
      <div className="space-y-3">
        {days.map(day => (
          <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
            <label className="flex items-center gap-2 min-w-[120px]">
              <input
                type="checkbox"
                checked={formData.availability[day].enabled}
                onChange={(e) => setFormData({
                  ...formData,
                  availability: {
                    ...formData.availability,
                    [day]: { ...formData.availability[day], enabled: e.target.checked }
                  }
                })}
                className="w-4 h-4"
              />
              <span className="capitalize font-medium">{day}</span>
            </label>
            {formData.availability[day].enabled && (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={formData.availability[day].start}
                  onChange={(e) => setFormData({
                    ...formData,
                    availability: {
                      ...formData.availability,
                      [day]: { ...formData.availability[day], start: e.target.value }
                    }
                  })}
                />
                <span>to</span>
                <Input
                  type="time"
                  value={formData.availability[day].end}
                  onChange={(e) => setFormData({
                    ...formData,
                    availability: {
                      ...formData.availability,
                      [day]: { ...formData.availability[day], end: e.target.value }
                    }
                  })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Step7_Inventory() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Package className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Inventory Management 📦
        </h2>
        <p className="text-lg text-gray-600">
          Track your supplies and never run out
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-green-600" />
          What Inventory Management Does:
        </h3>
        <div className="space-y-3 text-gray-700">
          <p className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
            <span>Track stock levels for all products and supplies</span>
          </p>
          <p className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
            <span>Get low stock alerts so you never run out</span>
          </p>
          <p className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
            <span>Track usage patterns and optimize ordering</span>
          </p>
          <p className="text-sm text-gray-600 mt-4 p-3 bg-white rounded border">
            💡 <strong>Perfect for:</strong> Spas, salons, clinics, or any business that uses products.
          </p>
        </div>
      </div>

      <div className="p-6 bg-gray-50 border rounded-lg text-center">
        <p className="text-gray-600">
          Skip this step for now. You can add inventory items from the Inventory page after setup.
        </p>
      </div>
    </div>
  )
}

function Step8_EmailTemplates() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Mail className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Email Templates Ready! 📧
        </h2>
        <p className="text-lg text-gray-600">
          Default templates will be created automatically
        </p>
      </div>
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Check className="h-6 w-6 text-green-600 mt-1" />
          <div>
            <h3 className="font-semibold text-green-900">Default Templates</h3>
            <p className="text-sm text-green-800 mt-1">
              We'll set up standard email templates for welcome messages, booking confirmations, 
              reminders, and more. You can customize them later in Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step9_DemoData({ formData, setFormData }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Users className="h-16 w-16 text-purple-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Generate Demo Data 🎭
        </h2>
        <p className="text-lg text-gray-600">
          Add realistic sample data to explore features
        </p>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Recommended:</strong> Enable this to populate your dashboard with sample bookings, 
            contacts, and inventory for testing and demonstration purposes.
          </p>
        </div>
        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.generateDummyData}
            onChange={(e) => setFormData({ ...formData, generateDummyData: e.target.checked })}
            className="mt-1 w-4 h-4"
          />
          <div>
            <p className="font-medium">Generate Sample Data</p>
            <p className="text-sm text-gray-600">
              Creates 15 contacts, 30 bookings, 4 inventory items, and sample conversations
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}