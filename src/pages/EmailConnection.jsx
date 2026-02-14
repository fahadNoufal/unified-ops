import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Mail, Settings, Check, AlertCircle, Eye, EyeOff, 
  Inbox, Send, RefreshCw, X, HelpCircle, ExternalLink
} from 'lucide-react'
import { emailConnectionAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import { toast } from 'sonner'

export default function EmailConnection() {
  const [showPassword, setShowPassword] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const queryClient = useQueryClient()

  const { data: connection, isLoading } = useQuery({
    queryKey: ['email-connection'],
    queryFn: () => emailConnectionAPI.get().then(res => res.data),
  })

  const [formData, setFormData] = useState({
    provider: connection?.provider || 'gmail',
    email: connection?.email || '',
    password: '',
    imap_host: connection?.imap_host || 'imap.gmail.com',
    imap_port: connection?.imap_port || 993,
    smtp_host: connection?.smtp_host || 'smtp.gmail.com',
    smtp_port: connection?.smtp_port || 587,
    is_active: connection?.is_active ?? true
  })

  const saveMutation = useMutation({
    mutationFn: (data) => emailConnectionAPI.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['email-connection'])
      toast.success('Email connection saved successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to save connection')
    },
  })

  const testMutation = useMutation({
    mutationFn: (data) => emailConnectionAPI.test(data),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success('Connection successful!')
      } else {
        toast.error(response.data.error || 'Connection failed')
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Connection test failed')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => emailConnectionAPI.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries(['email-connection'])
      toast.success('Email disconnected')
      setFormData({
        provider: 'gmail',
        email: '',
        password: '',
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        is_active: true
      })
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => emailConnectionAPI.syncNow(),
    onSuccess: () => {
      toast.success('Email sync started in background')
    },
  })

  const handleProviderChange = (provider) => {
    setFormData({
      ...formData,
      provider,
      imap_host: provider === 'gmail' ? 'imap.gmail.com' : 'outlook.office365.com',
      imap_port: 993,
      smtp_host: provider === 'gmail' ? 'smtp.gmail.com' : 'smtp.office365.com',
      smtp_port: 587
    })
  }

  const handleTest = () => {
    setTestingConnection(true)
    testMutation.mutate(formData, {
      onSettled: () => setTestingConnection(false)
    })
  }

  const handleSave = () => {
    if (!formData.email || !formData.password) {
      toast.error('Email and password are required')
      return
    }
    saveMutation.mutate(formData)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Email Connection</h1>
        <p className="text-gray-500 mt-1">Connect your email account to manage conversations in the inbox</p>
      </div>

      {/* Status Card */}
      {connection?.is_active && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-green-900">Email Connected</h3>
                    <p className="text-sm text-green-700 mt-1">{connection.email}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-green-600">
                      <div className="flex items-center gap-1">
                        <Inbox className="h-3 w-3" />
                        <span>Last synced: {connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : 'Never'}</span>
                      </div>
                      {connection.sync_status && (
                        <Badge className="bg-green-100 text-green-700">
                          {connection.sync_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => disconnectMutation.mutate()}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Setup Instructions */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100 border-b">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <HelpCircle className="h-5 w-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">For Gmail Users:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Enable 2-Factor Authentication in your Google Account</li>
                <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" className="underline font-medium">Google App Passwords</a></li>
                <li>Create an App Password for "Mail"</li>
                <li>Use that 16-character password below (not your regular password)</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">For Outlook/Office 365 Users:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Make sure IMAP is enabled in Outlook settings</li>
                <li>Use your regular Outlook password</li>
                <li>If you have 2FA, you may need an app password</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div>
            <Label className="mb-3 block">Email Provider</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleProviderChange('gmail')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.provider === 'gmail'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Gmail</p>
                    <p className="text-xs text-gray-500">@gmail.com</p>
                  </div>
                  {formData.provider === 'gmail' && (
                    <Check className="h-5 w-5 text-primary ml-auto" />
                  )}
                </div>
              </button>

              <button
                onClick={() => handleProviderChange('outlook')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.provider === 'outlook'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Outlook</p>
                    <p className="text-xs text-gray-500">@outlook.com</p>
                  </div>
                  {formData.provider === 'outlook' && (
                    <Check className="h-5 w-5 text-primary ml-auto" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Email & Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your-email@gmail.com"
              />
            </div>
            <div>
              <Label>Password / App Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Settings (IMAP/SMTP)
            </summary>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>IMAP Host</Label>
                  <Input
                    value={formData.imap_host}
                    onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                  />
                </div>
                <div>
                  <Label>IMAP Port</Label>
                  <Input
                    type="number"
                    value={formData.imap_port}
                    onChange={(e) => setFormData({ ...formData, imap_port: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>SMTP Host</Label>
                  <Input
                    value={formData.smtp_host}
                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  />
                </div>
                <div>
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={testingConnection || !formData.email || !formData.password}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${testingConnection ? 'animate-spin' : ''}`} />
              Test Connection
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !formData.email || !formData.password}
            >
              <Check className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Connection'}
            </Button>
          </div>

          {/* Status Messages */}
          {testMutation.isSuccess && (
            <div className={`p-3 rounded-lg border ${
              testMutation.data?.data?.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {testMutation.data?.data?.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {testMutation.data?.data?.message || testMutation.data?.data?.error}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="font-bold text-blue-600">1</span>
            </div>
            <div>
              <p className="font-medium">Incoming Emails</p>
              <p className="text-gray-600">When customers email you, their messages automatically appear in your Inbox. New contacts are created automatically.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="font-bold text-green-600">2</span>
            </div>
            <div>
              <p className="font-medium">Replies</p>
              <p className="text-gray-600">When you reply in the Inbox, your message is sent as a real email from your connected account.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="font-bold text-purple-600">3</span>
            </div>
            <div>
              <p className="font-medium">Contact Matching</p>
              <p className="text-gray-600">Emails are automatically matched to existing contacts by email address, maintaining your conversation history.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}