import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Eye, Edit, Trash2, Mail, Phone, Calendar,
  MapPin, FileText, Clock, X, User, ExternalLink, Share2, Loader2
} from 'lucide-react'
import { contactsAPI, bookingsAPI } from '../services/api'
import { Card, CardContent, Button, Badge, Input, Label, Skeleton } from '../components/ui'
import { formatDate, formatTime, getStatusColor } from '../lib/utils'
import { toast } from 'sonner'
import axios from 'axios'

const STATUS_FILTERS = [
  { key: 'all', label: 'All', color: 'bg-gray-100 text-gray-800' },
  { key: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'confirmed', label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  { key: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  { key: 'no_show', label: 'No Show', color: 'bg-red-100 text-red-800' },
  { key: 'no_response', label: 'No Response', color: 'bg-gray-100 text-gray-800' },
]

export default function Leads() {
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsAPI.list().then(res => res.data),
  })

  const { data: bookings } = useQuery({
    queryKey: ['all-bookings'],
    queryFn: () => bookingsAPI.list().then(res => res.data),
  })

  const authUser = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const workspaceSlug = authUser?.workspace_id || 'demo'

  if (isLoading) return <LeadsSkeleton />

  // Categorize leads
  const categorizedLeads = categorizeLeads(contacts || [], bookings || [])
  
  // Filter leads
  let filteredLeads = selectedStatus === 'all' 
    ? Object.values(categorizedLeads).flat()
    : categorizedLeads[selectedStatus] || []

  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filteredLeads = filteredLeads.filter(lead => 
      lead.name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query)
    )
  }

  // Get total counts
  const totalLeads = contacts?.length || 0
  const statusCounts = Object.keys(categorizedLeads).reduce((acc, key) => {
    acc[key] = categorizedLeads[key].length
    return acc
  }, {})

  const handleOpenContactForm = async () => {
    // 1. Open a blank tab immediately to satisfy browser popup blockers
        const newWindow = window.open('', '_blank');
        
        // Optional: Show a loading text in the new tab
        if (newWindow) {
            newWindow.document.write('Loading form...');
        }

        try {

            // 2. Ask the backend for the ID of 'Contact Information Form'
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/public/forms/lookup/${workspaceSlug}`,
                { params: { name: 'Contact Information Form' } }
            );

            const formId = response.data.form_id;

            // 3. Redirect the blank tab to the actual form
            if (newWindow) {
                newWindow.location.href = `/public/forms/${workspaceSlug}/${formId}`;
            }
            

        } catch (error) {
            // 4. Handle errors (form not found)
            console.error("Form lookup failed", error);
            if (newWindow) newWindow.close(); // Close the blank tab if we failed
            
            toast.error("Contact Information Form not found. Please ensure a form with this exact name exists.");
        }
    };
  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total members: <span className="font-semibold">{totalLeads}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenContactForm}>
            <Share2 className="mr-2 h-4 w-4" />
            Share Booking Form
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map(filter => (
                <Button
                  key={filter.key}
                  variant={selectedStatus === filter.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStatus(filter.key)}
                  className="relative"
                >
                  {filter.label}
                  {filter.key !== 'all' && statusCounts[filter.key] > 0 && (
                    <Badge className="ml-2 bg-white text-primary">
                      {statusCounts[filter.key]}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredLeads.length}</span> lead{filteredLeads.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mobile
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <User className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-4 text-gray-600">No leads found</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {searchQuery ? 'Try adjusting your search' : 'Add your first lead to get started'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, index) => (
                    <LeadTableRow
                      key={lead.id}
                      lead={lead}
                      index={index}
                      onClick={() => setSelectedLead(lead)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['contacts'])
            setShowAddModal(false)
          }}
        />
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => queryClient.invalidateQueries(['contacts'])}
        />
      )}
    </div>
  )
}

// Table Row Component
function LeadTableRow({ lead, index, onClick }) {
  const daysSinceCreated = Math.floor(
    (new Date() - new Date(lead.created_at)) / (1000 * 60 * 60 * 24)
  )

  return (
    <motion.tr
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-medium text-gray-900">{lead.name}</div>
      </td>

      {/* Mobile */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{lead.phone || '-'}</div>
      </td>

      {/* Email */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{lead.email || '-'}</div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge className={getLeadStatusColor(lead.leadStatus)}>
          {lead.leadStatus?.replace('_', ' ') || 'Pending'}
        </Badge>
      </td>

      {/* Source */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{lead.source || 'direct'}</div>
      </td>

      {/* Created */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{daysSinceCreated}d ago</div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </td>
    </motion.tr>
  )
}

// Add Lead Modal
function AddLeadModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  })

  const mutation = useMutation({
    mutationFn: (data) => contactsAPI.create(data),
    onSuccess: () => {
      toast.success('Lead added successfully')
      onSuccess()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to add lead')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      ...formData,
      source: 'manual'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              required
            />
          </div>

          <div>
            <Label>Phone</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information..."
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding...' : 'Add Lead'}
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

// Lead Detail Modal
function LeadDetailModal({ lead, onClose, onUpdate }) {
  const { data: bookings } = useQuery({
    queryKey: ['contact-bookings', lead.id],
    queryFn: () => bookingsAPI.list().then(res => 
      res.data.filter(b => b.contact_id === lead.id)
    ),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Lead Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">NAME</p>
                <p className="font-semibold">{lead.name}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">STATUS</p>
                <Badge className={getLeadStatusColor(lead.leadStatus)}>
                  {lead.leadStatus?.replace('_', ' ') || 'Pending'}
                </Badge>
              </div>
              {lead.email && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">EMAIL</p>
                  <p className="font-semibold">{lead.email}</p>
                </div>
              )}
              {lead.phone && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">PHONE</p>
                  <p className="font-semibold">{lead.phone}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">SOURCE</p>
                <p className="font-semibold">{lead.source || 'Direct'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">CREATED</p>
                <p className="font-semibold">{formatDate(lead.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">{lead.notes}</p>
              </div>
            </div>
          )}

          {/* Booking History */}
          {bookings && bookings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Bookings ({bookings.length})
              </h3>
              <div className="space-y-2">
                {bookings.map(booking => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <p className="font-semibold text-sm">{booking.service?.name || 'Service'}</p>
                      <p className="text-xs text-gray-600">
                        {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{lead.bookingCount || 0}</div>
                <p className="text-xs text-gray-600 mt-1">Total Bookings</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.floor((new Date() - new Date(lead.created_at)) / (1000 * 60 * 60 * 24))}
                </div>
                <p className="text-xs text-gray-600 mt-1">Days as Lead</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {lead.latestBooking ? formatDate(lead.latestBooking.start_time) : 'N/A'}
                </div>
                <p className="text-xs text-gray-600 mt-1">Last Activity</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </div>
  )
}

// Helper functions
function categorizeLeads(contacts, bookings) {
  const categorized = {
    pending: [],
    confirmed: [],
    completed: [],
    no_show: [],
    no_response: [],
  }

  contacts.forEach(contact => {
    const contactBookings = bookings.filter(b => b.contact_id === contact.id)
    
    const enrichedContact = {
      ...contact,
      bookings: contactBookings,
      bookingCount: contactBookings.length,
      latestBooking: contactBookings.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )[0]
    }

    if (contactBookings.length === 0) {
      const daysSinceCreated = (new Date() - new Date(contact.created_at)) / (1000 * 60 * 60 * 24)
      if (daysSinceCreated > 7) {
        enrichedContact.leadStatus = 'no_response'
        categorized.no_response.push(enrichedContact)
      } else {
        enrichedContact.leadStatus = 'pending'
        categorized.pending.push(enrichedContact)
      }
    } else {
      const latestBooking = enrichedContact.latestBooking
      enrichedContact.leadStatus = latestBooking.status
      
      switch (latestBooking.status) {
        case 'pending':
          categorized.pending.push(enrichedContact)
          break
        case 'confirmed':
          categorized.confirmed.push(enrichedContact)
          break
        case 'completed':
          categorized.completed.push(enrichedContact)
          break
        case 'no_show':
          categorized.no_show.push(enrichedContact)
          break
        default:
          categorized.pending.push(enrichedContact)
      }
    }
  })

  return categorized
}

function getLeadStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'confirmed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'completed':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'no_show':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'no_response':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }
}

function LeadsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardContent className="p-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}