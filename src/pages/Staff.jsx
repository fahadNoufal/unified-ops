import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trash2, Users, Mail, Shield, Check } from 'lucide-react'
import { staffAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import { formatDate, getInitials } from '../lib/utils'
import { toast } from 'sonner'

const PERMISSIONS = [
  { key: 'view_inbox', label: 'View & Reply Inbox', description: 'Access to customer conversations' },
  { key: 'manage_bookings', label: 'Manage Bookings', description: 'View, create, and edit appointments' },
  { key: 'view_forms', label: 'View Forms', description: 'Access form submissions' },
  { key: 'view_inventory', label: 'View Inventory', description: 'See stock levels' },
  { key: 'view_calendar', label: 'View Calendar', description: 'Access calendar view' },
  { key: 'mark_complete', label: 'Mark Bookings Complete', description: 'Mark appointments as complete/no-show' },
]

export default function Staff() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.list().then(res => res.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => staffAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['staff'])
      toast.success('Staff member removed')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Staff Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage team members and permissions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Staff Member
        </Button>
      </div>

      {/* Staff Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-48" /></Card>
          ))}
        </div>
      ) : staff?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold">No staff members yet</h3>
            <p className="mt-2 text-sm text-gray-500">Add your first staff member to get started</p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff?.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                      {getInitials(member.full_name)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this staff member?')) {
                          deleteMutation.mutate(member.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>

                  <h3 className="font-semibold text-lg">{member.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <Mail className="h-3 w-3" />
                    <span>{member.email}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Badge className={member.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="secondary">
                      <Shield className="h-3 w-3 mr-1" />
                      Staff
                    </Badge>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500">
                      Added {formatDate(member.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateStaffModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

function CreateStaffModal({ onClose }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    permissions: []
  })

  const mutation = useMutation({
    mutationFn: (data) => staffAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['staff'])
      toast.success('Staff member added! Credentials sent to their email.')
      onClose()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to add staff member')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  const togglePermission = (key) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key]
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-serif font-bold mb-4">Add Staff Member</h2>
        
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Login credentials will be automatically generated and sent to the staff member's email.
            Username will be their email address.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be their username for login
            </p>
          </div>

          <div>
            <Label className="mb-3 block">Permissions</Label>
            <div className="space-y-3 border rounded-lg p-4">
              {PERMISSIONS.map((perm) => (
                <label
                  key={perm.key}
                  className="flex items-start gap-3 p-3 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={formData.permissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                    />
                    {formData.permissions.includes(perm.key) && (
                      <Check className="absolute h-4 w-4 text-primary pointer-events-none" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{perm.label}</p>
                    <p className="text-xs text-gray-500">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding Staff...' : 'Add Staff Member'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
