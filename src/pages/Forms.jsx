import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { motion } from 'framer-motion'
import { Plus, Trash2, GripVertical, FileText, Eye, Type, Mail, Phone, Upload, CheckSquare, Calendar as CalendarIcon, List, Share2, BarChart3, Copy, Check, ExternalLink } from 'lucide-react'
import { formsAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import { toast } from 'sonner'

const FIELD_TYPES = [
  { type: 'text', label: 'Text Input', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'textarea', label: 'Long Text', icon: FileText },
  { type: 'dropdown', label: 'Dropdown', icon: List },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'file', label: 'File Upload', icon: Upload },
  { type: 'date', label: 'Date', icon: CalendarIcon },
]

export default function Forms() {
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list', 'submissions', 'analytics'
  const [selectedFormForView, setSelectedFormForView] = useState(null)

  const { data: forms, isLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: () => formsAPI.list().then(res => res.data),
  })

  const handleCreateNew = () => {
    setSelectedForm(null)
    setShowBuilder(true)
  }

  const handleEdit = (form) => {
    setSelectedForm(form)
    setShowBuilder(true)
  }

  const handleViewSubmissions = (form) => {
    setSelectedFormForView(form)
    setViewMode('submissions')
  }

  const handleViewAnalytics = (form) => {
    setSelectedFormForView(form)
    setViewMode('analytics')
  }

  if (showBuilder) {
    return (
      <FormBuilder
        form={selectedForm}
        onClose={() => {
          setShowBuilder(false)
          setSelectedForm(null)
        }}
      />
    )
  }

  if (viewMode === 'submissions' && selectedFormForView) {
    return (
      <FormSubmissionsView
        form={selectedFormForView}
        onBack={() => {
          setViewMode('list')
          setSelectedFormForView(null)
        }}
      />
    )
  }

  if (viewMode === 'analytics' && selectedFormForView) {
    return (
      <FormAnalyticsView
        form={selectedFormForView}
        onBack={() => {
          setViewMode('list')
          setSelectedFormForView(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Forms</h1>
          <p className="mt-1 text-sm text-gray-500">Create and manage custom forms</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Create Form
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-48" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms?.map((form, index) => (
            <motion.div
              key={form.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <FileText className="h-8 w-8 text-primary" />
                    <Badge variant="secondary">{form.form_type}</Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{form.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{form.description || 'No description'}</p>
                  
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-gray-500">{form.fields?.length || 0} fields</span>
                    <Badge className={form.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {form.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(form)}>
                      <Eye className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleViewSubmissions(form)}>
                      <FileText className="h-3 w-3 mr-1" />
                      Submissions
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleViewAnalytics(form)}>
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Analytics
                    </Button>
                    <ShareFormButton form={form} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && forms?.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold">No forms yet</h3>
            <p className="mt-2 text-sm text-gray-500">Create your first custom form to get started</p>
            <Button className="mt-4" onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Form
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ShareFormButton({ form }) {
  const [copied, setCopied] = useState(false)
  const workspace = JSON.parse(localStorage.getItem('auth_user') || '{}')
  
  // Get workspace slug from user data
  const workspaceSlug = workspace?.workspace_id || 'demo'
  
  // Construct public form URL - THIS is what you share!
  const publicUrl = `${window.location.origin}/public/forms/${workspaceSlug}/${form.id}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success('Form link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const openInNewTab = () => {
    window.open(publicUrl, '_blank')
  }

  return (
    <div className="col-span-2 flex gap-2">
      <Button 
        size="sm" 
        variant="outline" 
        onClick={copyToClipboard}
        className="flex-1"
      >
        {copied ? (
          <Check className="h-3 w-3 mr-1 text-green-600" />
        ) : (
          <Share2 className="h-3 w-3 mr-1" />
        )}
        {copied ? 'Copied!' : 'Copy Link'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={openInNewTab}
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  )
}

function FormSubmissionsView({ form, onBack }) {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['form-submissions', form.id],
    queryFn: () => formsAPI.getFormSubmission(form.id).then(res => res.data),
  })
  
  // console.log('Submissions for form', form, submissions)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2">
            ← Back to Forms
          </Button>
          <h1 className="text-4xl font-serif font-bold">{form.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Form submissions</p>
        </div>
        <Badge className="text-lg px-4 py-2">
          {submissions?.length || 0} Submissions
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : submissions?.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No submissions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">{submission.contact?.name || 'Unknown'}</p>
                      {submission.contact?.email && (
                        <p className="text-sm text-gray-500">{submission.contact.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge className={
                        submission.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : submission.status === 'opened'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }>
                        {submission.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {submission.submitted_at 
                          ? new Date(submission.submitted_at).toLocaleDateString()
                          : new Date(submission.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {submission.submission_data && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border">
                      <p className="text-sm font-medium mb-2">Submission Data:</p>
                      <div className="space-y-1">
                        {Object.entries(submission.submission_data).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-600">{key}:</span>{' '}
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FormAnalyticsView({ form, onBack }) {
  // Mock analytics for now - you can implement real analytics endpoint later
  const { data: submissions } = useQuery({
    queryKey: ['form-submissions', form.id],
    queryFn: () => formsAPI.getFormAnalytics(form.id ).then(res => res.data),
  })

  const analytics = {
    total_submissions: submissions?.total_submissions || 0,
    submitted_count: submissions?.submitted_count || 0,
    pending_count: submissions?.pending_count || 0,
    completion_rate: submissions?.completion_rate || 0,
    open_rate: submissions?.open_rate || 0,
    avg_time_to_submit: submissions?.avg_time_to_submit || 0, // Placeholder
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-2">
          ← Back to Forms
        </Button>
        <h1 className="text-4xl font-serif font-bold">{form.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Form analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Submissions</p>
                <p className="text-3xl font-bold mt-1">{analytics.total_submissions}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-3xl font-bold mt-1">{analytics.completion_rate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Rate</p>
                <p className="text-3xl font-bold mt-1">{analytics.open_rate}%</p>
              </div>
              <Eye className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Submitted</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{analytics.submitted_count}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{analytics.pending_count}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Avg. Time to Submit</p>
            <p className="text-2xl font-bold mt-1">{analytics.avg_time_to_submit}m</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">Completion Rate</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${analytics.completion_rate}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{analytics.completion_rate}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">Open Rate</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500"
                    style={{ width: `${analytics.open_rate}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{analytics.open_rate}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// FormBuilder component with FIXED LOGIC
function FormBuilder({ form, onClose }) {
  const queryClient = useQueryClient()
  
  // Initialize with properly formatted fields
  const [formData, setFormData] = useState({
    name: form?.name || '',
    form_type: form?.form_type || 'post_booking',
    description: form?.description || '',
    fields: form?.fields?.map((field, index) => ({
      ...field,
      id: field.id || `field_${Date.now()}_${index}`, // Ensure every field has an id
    })) || [],
  })
  
  const [showPreview, setShowPreview] = useState(false)

  // FIXED: Separate create and update mutations
  const createMutation = useMutation({
    mutationFn: (data) => {
      // Transform fields to match backend schema
      const payload = {
        name: data.name,
        form_type: data.form_type,
        description: data.description,
        fields: data.fields.map(field => ({
          label: field.label,
          field_type: field.type, // Backend expects 'field_type', not 'type'
          required: field.required || false,
          placeholder: field.placeholder || '',
          options: field.options || null,
          help_text: field.help_text || null,
        })),
      }
      return formsAPI.create(payload)
    },
    onSuccess: () => {
      toast.success('Form created successfully')
      queryClient.invalidateQueries(['forms'])
      onClose()
    },
    onError: (error) => {
      console.error('Create error:', error)
      toast.error(error.response?.data?.detail || 'Failed to create form')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => {
      // Transform fields to match backend schema
      const payload = {
        name: data.name,
        form_type: data.form_type,
        description: data.description,
        fields: data.fields.map(field => ({
          label: field.label,
          field_type: field.type, // Backend expects 'field_type', not 'type'
          required: field.required || false,
          placeholder: field.placeholder || '',
          options: field.options || null,
          help_text: field.help_text || null,
        })),
      }
      return formsAPI.update(form.id, payload)
    },
    onSuccess: () => {
      toast.success('Form updated successfully')
      queryClient.invalidateQueries(['forms'])
      onClose()
    },
    onError: (error) => {
      console.error('Update error:', error)
      toast.error(error.response?.data?.detail || 'Failed to update form')
    },
  })

  const addField = (type) => {
    const newField = {
      id: `field_${Date.now()}`,
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      required: false,
      placeholder: '',
      options: type === 'dropdown' ? ['Option 1', 'Option 2'] : null,
      help_text: '',
    }
    setFormData({ ...formData, fields: [...formData.fields, newField] })
  }

  const updateField = (id, updates) => {
    setFormData({
      ...formData,
      fields: formData.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    })
  }

  const deleteField = (id) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter(f => f.id !== id)
    })
  }

  const onDragEnd = (result) => {
    if (!result.destination) return
    
    const fields = Array.from(formData.fields)
    const [removed] = fields.splice(result.source.index, 1)
    fields.splice(result.destination.index, 0, removed)
    
    setFormData({ ...formData, fields })
  }

  const handleSave = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Form name is required')
      return
    }
    
    if (formData.fields.length === 0) {
      toast.error('Please add at least one field')
      return
    }

    // Validate all fields have labels
    const invalidFields = formData.fields.filter(f => !f.label.trim())
    if (invalidFields.length > 0) {
      toast.error('All fields must have labels')
      return
    }

    // Use appropriate mutation based on whether editing or creating
    if (form) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">{form ? 'Edit Form' : 'Create Form'}</h1>
          <p className="mt-1 text-sm text-gray-500">Design your custom form with drag-and-drop</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : form ? 'Update Form' : 'Save Form'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>

      {showPreview ? (
        <FormPreview formData={formData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader><CardTitle>Form Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Form Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Client Intake Form"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <select
                    className="w-full mt-1 rounded-md border border-gray-300 p-2"
                    value={formData.form_type}
                    onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
                  >
                    <option value="intake">Intake</option>
                    <option value="questionnaire">Questionnaire</option>
                    <option value="consent">Consent</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea
                    className="w-full mt-1 rounded-md border border-gray-300 p-2"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                  />
                </div>

                <div className="pt-4 border-t">
                  <Label className="mb-2 block">Add Fields</Label>
                  <div className="space-y-2">
                    {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => addField(type)}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-gray-100 transition-colors text-sm"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle>Form Fields ({formData.fields.length})</CardTitle></CardHeader>
              <CardContent>
                {formData.fields.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 text-gray-500">Add fields from the sidebar to start building your form</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="fields">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {formData.fields.map((field, index) => (
                            <Draggable key={field.id} draggableId={field.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="bg-white border rounded-lg p-4"
                                >
                                  <div className="flex items-start gap-3">
                                    <div {...provided.dragHandleProps} className="mt-2">
                                      <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                      <div className="flex gap-3">
                                        <div className="flex-1">
                                          <Label>Label *</Label>
                                          <Input
                                            value={field.label}
                                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                                            placeholder="Field label"
                                          />
                                        </div>
                                        <div className="flex-1">
                                          <Label>Placeholder</Label>
                                          <Input
                                            value={field.placeholder || ''}
                                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                            placeholder="Placeholder text"
                                          />
                                        </div>
                                      </div>
                                      
                                      {/* Options for dropdown fields */}
                                      {field.type === 'dropdown' && (
                                        <div>
                                          <Label>Options (comma-separated)</Label>
                                          <Input
                                            value={field.options?.join(', ') || ''}
                                            onChange={(e) => updateField(field.id, { 
                                              options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                                            })}
                                            placeholder="Option 1, Option 2, Option 3"
                                          />
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                          />
                                          <span className="text-sm">Required</span>
                                        </label>
                                        <Badge variant="secondary">{field.type}</Badge>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteField(field.id)}
                                      className="mt-6"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function FormPreview({ formData }) {
  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{formData.name || 'Untitled Form'}</CardTitle>
        {formData.description && <p className="text-sm text-gray-500 mt-1">{formData.description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {formData.fields.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No fields added yet
          </div>
        ) : (
          <>
            {formData.fields.map((field) => (
              <div key={field.id}>
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.type === 'textarea' ? (
                  <textarea 
                    className="w-full mt-1 rounded-md border p-2" 
                    rows={3} 
                    placeholder={field.placeholder}
                    disabled 
                  />
                ) : field.type === 'dropdown' ? (
                  <select className="w-full mt-1 rounded-md border p-2" disabled>
                    <option value="">Select...</option>
                    {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <div className="mt-1">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" disabled />
                      <span className="text-sm">{field.placeholder || field.label}</span>
                    </label>
                  </div>
                ) : field.type === 'file' ? (
                  <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center bg-gray-50">
                    <Upload className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Click to upload or drag and drop</p>
                  </div>
                ) : (
                  <Input 
                    type={field.type} 
                    placeholder={field.placeholder} 
                    className="mt-1"
                    disabled 
                  />
                )}
              </div>
            ))}
            <Button className="w-full" disabled>Submit Form</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}