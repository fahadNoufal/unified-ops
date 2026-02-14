import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, Save, Eye, Plus, X, AlertCircle, Check, 
  Send, Clock, User, Calendar, FileText, ChevronRight, Zap
} from 'lucide-react'
import { emailTemplatesAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import { toast } from 'sonner'

const TEMPLATE_TYPES = [
  {
    key: 'welcome',
    label: 'Welcome Email',
    description: 'Sent to new leads when they first register',
    icon: User,
    color: 'bg-blue-500',
    variables: ['{{customer_name}}', '{{business_name}}', '{{welcome_form_url}}', '{{booking_url}}']
  },
  {
    key: 'booking_confirmation',
    label: 'Booking Confirmation',
    description: 'Sent when customer makes a booking',
    icon: Calendar,
    color: 'bg-green-500',
    variables: ['{{customer_name}}', '{{booking_date}}', '{{booking_time}}', '{{service_name}}', '{{location}}', '{{pre_appointment_form_url}}']
  },
  {
    key: 'form_reminder',
    label: 'Form Reminder',
    description: 'Sent when customer hasn\'t filled required form within 24h',
    icon: FileText,
    color: 'bg-orange-500',
    variables: ['{{customer_name}}', '{{form_name}}', '{{form_url}}', '{{deadline}}']
  },
  {
    key: 'booking_reminder',
    label: 'Booking Reminder',
    description: 'Sent 24h before appointment',
    icon: Clock,
    color: 'bg-purple-500',
    variables: ['{{customer_name}}', '{{booking_date}}', '{{booking_time}}', '{{service_name}}', '{{location}}']
  }
]

export default function EmailTemplateSettings() {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const queryClient = useQueryClient()

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailTemplatesAPI.list().then(res => res.data),
  })

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Templates</h2>
          <p className="text-gray-500 text-sm mt-1">Customize automated emails sent to your customers</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700">
          {templates?.length || 0} / {TEMPLATE_TYPES.length} configured
        </Badge>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATE_TYPES.map((templateType, index) => {
          const existingTemplate = templates?.find(t => t.template_type === templateType.key)
          const Icon = templateType.icon
          
          return (
            <motion.div
              key={templateType.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`border-2 hover:shadow-lg transition-all cursor-pointer ${
                existingTemplate ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
              }`}
                onClick={() => setSelectedTemplate(existingTemplate || { template_type: templateType.key })}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl ${templateType.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{templateType.label}</h3>
                        {existingTemplate && existingTemplate.is_active && (
                          <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{templateType.description}</p>
                      <div className="flex items-center gap-2">
                        {existingTemplate ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-600 font-medium">Configured</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                            <span className="text-xs text-orange-600 font-medium">Not configured</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Email Flow Diagram */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Automated Email Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <FlowStep
              number={1}
              title="Welcome Email"
              description="Sent immediately when new lead registers"
              icon={User}
              color="bg-blue-500"
            />
            <FlowStep
              number={2}
              title="Form Reminder"
              description="Sent 24h later if welcome form not filled"
              icon={Clock}
              color="bg-orange-500"
            />
            <FlowStep
              number={3}
              title="Booking Confirmation"
              description="Sent when customer books appointment"
              icon={Calendar}
              color="bg-green-500"
            />
            <FlowStep
              number={4}
              title="Pre-Appointment Form"
              description="Sent with booking confirmation"
              icon={FileText}
              color="bg-purple-500"
            />
            <FlowStep
              number={5}
              title="Appointment Reminder"
              description="Sent 24h before appointment"
              icon={Clock}
              color="bg-indigo-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {selectedTemplate && (
        <TemplateEditorModal
          template={selectedTemplate}
          templateType={TEMPLATE_TYPES.find(t => t.key === selectedTemplate.template_type)}
          onClose={() => setSelectedTemplate(null)}
          onSuccess={() => {
            queryClient.invalidateQueries(['email-templates'])
            setSelectedTemplate(null)
          }}
        />
      )}
    </div>
  )
}

// Flow Step Component
function FlowStep({ number, title, description, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`h-10 w-10 rounded-full ${color} flex items-center justify-center text-white font-bold flex-shrink-0`}>
        {number}
      </div>
      <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  )
}

// Template Editor Modal
function TemplateEditorModal({ template, templateType, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    subject: template.subject || '',
    body: template.body || '',
    is_active: template.is_active ?? true
  })
  const [showPreview, setShowPreview] = useState(false)

  const mutation = useMutation({
    mutationFn: (data) => {
      if (template.id) {
        return emailTemplatesAPI.update(template.id, data)
      } else {
        return emailTemplatesAPI.create({
          template_type: template.template_type,
          ...data
        })
      }
    },
    onSuccess: () => {
      toast.success('Template saved successfully')
      onSuccess()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to save template')
    },
  })

  const insertVariable = (variable) => {
    const textarea = document.getElementById('email-body')
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.body
    const before = text.substring(0, start)
    const after = text.substring(end)
    const newText = before + variable + after
    
    setFormData({ ...formData, body: newText })
    
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${templateType.color} flex items-center justify-center`}>
              <templateType.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{templateType.label}</h2>
              <p className="text-sm text-gray-500">{templateType.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Subject */}
          <div>
            <Label>Email Subject *</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Enter email subject..."
              className="mt-1"
            />
          </div>

          {/* Variables */}
          <div>
            <Label className="mb-2 block">Available Variables</Label>
            <div className="flex flex-wrap gap-2">
              {templateType.variables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-mono hover:bg-blue-100 transition-colors"
                >
                  {variable}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Click a variable to insert it at cursor position</p>
          </div>

          {/* Body */}
          <div>
            <Label>Email Body *</Label>
            <textarea
              id="email-body"
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Write your email content here...&#10;&#10;Use variables like {{customer_name}} to personalize the email."
              className="w-full mt-1 rounded-lg border border-gray-300 p-3 min-h-[300px] font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="is-active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-primary rounded"
            />
            <Label htmlFor="is-active" className="cursor-pointer">
              Enable this email template (will be sent automatically when triggered)
            </Label>
          </div>

          {/* Preview */}
          {showPreview && (
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-sm">Email Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Subject:</p>
                    <p className="font-semibold">{formData.subject || '(No subject)'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Body:</p>
                    <div className="prose prose-sm max-w-none">
                      {formData.body.split('\n').map((line, i) => (
                        <p key={i}>{line || '\u00A0'}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={() => mutation.mutate(formData)}
              disabled={mutation.isPending || !formData.subject || !formData.body}
            >
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}