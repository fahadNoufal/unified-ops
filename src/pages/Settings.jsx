import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Save, Mail, Building, Clock, Bell, Inbox,
  Eye, EyeOff, Check, AlertCircle, RefreshCw, Settings as SettingsIcon, HelpCircle
} from 'lucide-react'
import { workspaceAPI, emailConnectionAPI } from '../services/api'  // ADDED emailConnectionAPI
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import { toast } from 'sonner'
import EmailTemplateSettings from './EmailTemplateSettings'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'email', label: 'Email Integration', icon: Mail, subtitle: 'Resend API' },
    { id: 'custom-email', label: 'Custom Email', icon: Inbox, subtitle: 'Gmail/Outlook' },  // NEW
    { id: 'templates', label: 'Email Templates', icon: Bell },
    { id: 'availability', label: 'Availability', icon: Clock },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-serif font-bold">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your workspace configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <span className="font-medium block">{tab.label}</span>
                      {tab.subtitle && (
                        <span className={`text-xs ${
                          activeTab === tab.id ? 'text-white/80' : 'text-gray-500'
                        }`}>
                          {tab.subtitle}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'email' && <EmailSettings />}
            {activeTab === 'custom-email' && <CustomEmailSettings />}  {/* NEW */}
            {activeTab === 'templates' && <EmailTemplateSettings />}
            {activeTab === 'availability' && <AvailabilitySettings />}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const queryClient = useQueryClient()
  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => workspaceAPI.get().then(res => res.data),
  })

  const [formData, setFormData] = useState({
    name: workspace?.name || '',
    business_address: workspace?.business_address || '',
    contact_email: workspace?.contact_email || '',
    contact_phone: workspace?.contact_phone || '',
    timezone: workspace?.timezone || 'UTC',
  })

  const mutation = useMutation({
    mutationFn: (data) => workspaceAPI.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspace'])
      toast.success('Settings saved')
    },
  })

  const handleSave = () => {
    mutation.mutate(formData)
  }

  return (
    <Card>
      <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Business Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div>
          <Label>Business Address</Label>
          <Input
            value={formData.business_address}
            onChange={(e) => setFormData({...formData, business_address: e.target.value})}
            placeholder="123 Main St, City, State 12345"
          />
          <p className="text-xs text-gray-500 mt-1">
            This address will be included in booking confirmation emails
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Contact Email</Label>
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used as the 'from' address in automated emails
            </p>
          </div>
          <div>
            <Label>Contact Phone</Label>
            <Input
              value={formData.contact_phone}
              onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
            />
          </div>
        </div>
        <div>
          <Label>Timezone</Label>
          <select
            className="w-full mt-1 rounded-md border p-2"
            value={formData.timezone}
            onChange={(e) => setFormData({...formData, timezone: e.target.value})}
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}

function EmailSettings() {
  const queryClient = useQueryClient()
  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => workspaceAPI.get().then(res => res.data),
  })

  const [apiKey, setApiKey] = useState(workspace?.email_api_key || '')
  const [showKey, setShowKey] = useState(false)

  const mutation = useMutation({
    mutationFn: (data) => workspaceAPI.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspace'])
      toast.success('Email settings saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save email settings')
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Integration (Resend)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Box */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Automated Email Service</h3>
              <p className="text-sm text-blue-800">
                Connect your Resend account to enable automated emails for welcome messages, 
                booking confirmations, and reminders.
              </p>
              <a 
                href="https://resend.com/api-keys" 
                target="_blank"
                rel="noopener noreferrer" 
                className="text-sm text-blue-600 hover:text-blue-700 underline mt-2 inline-block font-medium"
              >
                Get your API key from Resend →
              </a>
            </div>
          </div>
        </div>

        {/* API Key Input */}
        <div>
          <Label className="mb-2 block">Resend API Key</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxxxx"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Your API key is encrypted and stored securely. If not provided, emails will use the system default.
          </p>
        </div>

        {/* Status */}
        {workspace?.email_api_key && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Email integration active</span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={() => mutation.mutate({ email_api_key: apiKey })}
            disabled={mutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Saving...' : 'Save API Key'}
          </Button>
          {workspace?.email_api_key && apiKey !== workspace?.email_api_key && (
            <Button 
              variant="outline"
              onClick={() => setApiKey(workspace?.email_api_key || '')}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// NEW: Custom Email Settings (Gmail/Outlook Connection)
function CustomEmailSettings() {
  const [showPassword, setShowPassword] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const queryClient = useQueryClient()

  const { data: connection, isLoading } = useQuery({
    queryKey: ['email-connection'],
    queryFn: () => emailConnectionAPI.get().then(res => res.data),
    retry: false
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
      toast.success('Email connected! Syncing emails in background...')
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

  if (isLoading) {
    return <Card><CardContent className="p-6">Loading...</CardContent></Card>
  }

  return (
    <div className="space-y-6">
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
                        <SettingsIcon className="h-3 w-3" />
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

      {/* Info Box */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 mb-1">Receive & Reply to Customer Emails</h3>
              <p className="text-sm text-purple-800">
                Connect your Gmail or Outlook account to receive customer emails directly in your Inbox. 
                Reply to customers and they'll receive real emails from your connected account.
              </p>
              <div className="mt-3 text-xs text-purple-700">
                <strong>Note:</strong> This is different from "Email Integration (Resend)" which sends automated emails. 
                This connects your actual email account for 2-way conversations.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <h4 className="font-semibold text-blue-900 mb-2">For Gmail:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Enable 2-Factor Authentication in your Google Account</li>
                <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google App Passwords</a></li>
                <li>Create an App Password for "Mail"</li>
                <li>Use that 16-character password below (not your regular password)</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">For Outlook:</h4>
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
              <SettingsIcon className="h-4 w-4" />
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
              {saveMutation.isPending ? 'Saving...' : 'Save & Start Syncing'}
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
    </div>
  )
}

function AvailabilitySettings() {
  return (
    <Card>
      <CardHeader><CardTitle>Availability Settings</CardTitle></CardHeader>
      <CardContent>
        <p className="text-gray-600">Configure your working hours and booking settings here.</p>
      </CardContent>
    </Card>
  )
}