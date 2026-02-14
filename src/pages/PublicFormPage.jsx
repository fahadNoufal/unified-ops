import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '../components/ui'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export default function PublicFormPage() {
  const { workspaceSlug, formId } = useParams()
  const [formData, setFormData] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [formValues, setFormValues] = useState({})

  useEffect(() => {
    fetchForm()
  }, [workspaceSlug, formId])

  const fetchForm = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/public/forms/${workspaceSlug}/${formId}`
      )

      setFormData(response.data.form)
      setWorkspace(response.data.workspace)

      const initialValues = {
        email: ''
      }

      response.data.form.fields.forEach(field => {
        initialValues[field.label] = ''
      })

      setFormValues(initialValues)
      setLoading(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Form not found')
      setLoading(false)
    }
  }

  const handleInputChange = (fieldLabel, value) => {
    setFormValues(prev => ({
      ...prev,
      [fieldLabel]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formValues.email?.trim()) {
      alert('Email is required')
      return
    }

    const requiredFields = formData.fields.filter(f => f.required)
    const missingFields = requiredFields.filter(f => {
      const value = formValues[f.label]
      if (!value) return true
      if (typeof value === 'string') return !value.trim()
      return false
    })

    if (missingFields.length > 0) {
      alert(
        `Please fill in all required fields: ${missingFields
          .map(f => f.label)
          .join(', ')}`
      )
      return
    }

    setSubmitting(true)

    try {
      await axios.post(
        `${API_URL}/public/forms/${workspaceSlug}/${formId}/submit`,
        formValues
      )

      console.log('Form submitted successfully', formValues)
      setSubmitted(true)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-semibold">Form Not Found</h2>
            <p className="mt-2 text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              </motion.div>
              <h2 className="mt-6 text-2xl font-bold">Thank You!</h2>
              <p className="mt-2 text-gray-600">
                Your form has been submitted successfully.
              </p>
              <p className="mt-4 text-sm text-gray-500">
                We'll get back to you soon.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          {workspace?.logo_url && (
            <img
              src={workspace.logo_url}
              alt={workspace.name}
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">
            {workspace?.name}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {formData?.name}
              </CardTitle>
              {formData?.description && (
                <p className="text-gray-600 mt-2">
                  {formData.description}
                </p>
              )}
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Label className="text-base">
                    Email
                    <span className="text-red-500 ml-1">*</span>
                  </Label>

                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="mt-2"
                    value={formValues.email || ''}
                    onChange={(e) =>
                      handleInputChange('email', e.target.value)
                    }
                    required
                  />
                </motion.div>

                {formData?.fields.map((field, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (index + 1) * 0.1 }}
                  >
                    <Label className="text-base">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>

                    {field.type === 'textarea' ? (
                      <textarea
                        className="w-full mt-2 rounded-md border border-gray-300 p-3 focus:ring-2 focus:ring-primary focus:border-transparent"
                        rows={4}
                        placeholder={field.placeholder}
                        value={formValues[field.label] || ''}
                        onChange={(e) =>
                          handleInputChange(field.label, e.target.value)
                        }
                        required={field.required}
                      />
                    ) : field.type === 'dropdown' ? (
                      <select
                        className="w-full mt-2 rounded-md border border-gray-300 p-3 focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={formValues[field.label] || ''}
                        onChange={(e) =>
                          handleInputChange(field.label, e.target.value)
                        }
                        required={field.required}
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div className="mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 focus:ring-primary"
                            checked={
                              formValues[field.label] === 'true'
                            }
                            onChange={(e) =>
                              handleInputChange(
                                field.label,
                                e.target.checked ? 'true' : 'false'
                              )
                            }
                          />
                          <span>
                            {field.placeholder || 'I agree'}
                          </span>
                        </label>
                      </div>
                    ) : field.type === 'date' ? (
                      <Input
                        type="date"
                        className="mt-2"
                        value={formValues[field.label] || ''}
                        onChange={(e) =>
                          handleInputChange(field.label, e.target.value)
                        }
                        required={field.required}
                      />
                    ) : field.type === 'file' ? (
                      <Input
                        type="file"
                        className="mt-2"
                        onChange={(e) =>
                          handleInputChange(
                            field.label,
                            e.target.files[0]?.name || ''
                          )
                        }
                        required={field.required}
                      />
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        className="mt-2"
                        value={formValues[field.label] || ''}
                        onChange={(e) =>
                          handleInputChange(field.label, e.target.value)
                        }
                        required={field.required}
                      />
                    )}
                  </motion.div>
                ))}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Form'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-sm text-gray-500 mt-8">
          Powered by {workspace?.name}
        </p>
      </div>
    </div>
  )
}
