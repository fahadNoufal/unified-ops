import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Upload, Loader2, AlertCircle } from 'lucide-react'
import { publicAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '../components/ui'
import { toast } from 'sonner'

export default function PublicForm() {
  const { token } = useParams()
  const [form, setForm] = useState(null)
  
  // Stores text values for validation and UI display
  const [formData, setFormData] = useState({})
  
  // Stores actual File objects for upload
  const [files, setFiles] = useState({})
  
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  console.log(formData)

  useEffect(() => {
    loadForm()
  }, [token])

  const loadForm = async () => {
    try {
      setLoading(true)
      const { data } = await publicAPI.getForm(token)
      setForm(data)
      // Initialize form data structure
      const initialData = {}
      data.form_template?.fields?.forEach(field => {
        initialData[field.id] = ''
      })
      setFormData(initialData)
    } catch (error) {
      setError('Form not found or expired')
      toast.error('Form not found or expired')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (fieldId, e) => {
    const file = e.target.files[0]
    if (file) {
      // 1. Store the actual File object (for sending to API)
      setFiles(prev => ({...prev, [fieldId]: file}))
      
      // 2. Store the filename (for validation checks & UI display)
      setFormData(prev => ({...prev, [fieldId]: file.name}))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Validate required fields
      const requiredFields = form.form_template.fields.filter(f => f.required)
      const missing = requiredFields.filter(f => !formData[f.id])
      
      if (missing.length > 0) {
        toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`)
        setLoading(false)
        return
      }

      // 2. Create FormData object (REQUIRED for file uploads)
      const submissionData = new FormData()
      
      // Append all fields to FormData
      Object.keys(formData).forEach(key => {
        // If this field exists in our 'files' state, append the File object
        if (files[key]) {
          submissionData.append(key, files[key]) 
        } else {
          // Otherwise, append the text value
          submissionData.append(key, formData[key])
        }
      })

      // 3. Send the FormData
      // Note: Ensure your publicAPI.submitForm accepts this 2nd argument as data
      await publicAPI.submitForm(token, submissionData)
      
      setSubmitted(true)
      toast.success('Form submitted successfully!')
    } catch (error) {
      console.error("Submission error:", error)
      toast.error('Failed to submit form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field) => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <Input
            type={field.type}
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
            placeholder={field.placeholder}
            required={field.required}
          />
        )
      
      case 'textarea':
        return (
          <textarea
            className="w-full mt-1 rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            rows={4}
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
            placeholder={field.placeholder}
            required={field.required}
          />
        )
      
      case 'dropdown':
        return (
          <select
            className="w-full mt-1 rounded-md border border-gray-300 p-2 bg-white focus:ring-2 focus:ring-primary outline-none"
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
            required={field.required}
          >
            <option value="">Select...</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        )
      
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              checked={formData[field.id] === 'true'}
              onChange={(e) => setFormData({...formData, [field.id]: e.target.checked ? 'true' : 'false'})}
            />
            <span className="text-sm text-gray-700">{field.placeholder || field.label}</span>
          </label>
        )
      
      case 'file':
        return (
          <div className="mt-1">
            <input
              type="file"
              id={`file-${field.id}`}
              className="hidden"
              onChange={(e) => handleFileChange(field.id, e)}
              required={field.required && !files[field.id]} // Only require if no file selected yet
            />
            <label 
              htmlFor={`file-${field.id}`} 
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                ${files[field.id] 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {files[field.id] ? (
                  <>
                    <Check className="w-8 h-8 text-green-500 mb-2" />
                    <p className="text-sm text-green-600 font-medium">
                      {files[field.id].name}
                    </p>
                    <p className="text-xs text-green-500 mt-1">Click to change</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {field.placeholder || 'Any file type'}
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>
        )
      
      case 'date':
        return (
          <Input
            type="date"
            value={formData[field.id] || ''}
            onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
            required={field.required}
          />
        )
      
      default:
        return null
    }
  }

  // Loading State
  if (loading && !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-red-100">
            <CardContent className="flex flex-col items-center py-10 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Form Not Available</h3>
                <p className="text-gray-500">{error}</p>
            </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4 transition-colors duration-300">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl bg-white/90 backdrop-blur-sm">
          {!submitted ? (
            <>
              <CardHeader className="border-b bg-white/50">
                <CardTitle className="text-2xl font-bold text-gray-900">{form?.form_template?.name}</CardTitle>
                {form?.form_template?.description && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    {form.form_template.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {form?.form_template?.fields?.map((field) => (
                    <div key={field.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <Label className="text-base font-medium text-gray-700 mb-1.5 block">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
                      </Label>
                      <div className="mt-1">
                        {renderField(field)}
                      </div>
                    </div>
                  ))}

                  <div className="pt-4">
                    <Button 
                        type="submit" 
                        className="w-full h-12 text-lg font-medium transition-all hover:scale-[1.01]" 
                        disabled={loading}
                    >
                        {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Submitting...
                        </>
                        ) : (
                        'Submit Form'
                        )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-serif font-bold mb-4 text-gray-900">Thank You!</h2>
                <p className="text-gray-600 text-lg">
                  Your response has been recorded successfully.
                </p>
                <p className="text-gray-400 text-sm mt-8">
                    You can close this tab now.
                </p>
              </motion.div>
            </CardContent>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by <span className="font-semibold text-gray-500">Unified Operations Platform</span>
        </p>
      </div>
    </div>
  )
}