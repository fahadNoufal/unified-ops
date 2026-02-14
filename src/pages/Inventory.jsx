import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, AlertCircle, TrendingDown, TrendingUp, Package } from 'lucide-react'
import { inventoryAPI } from '../services/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '../components/ui'
import { toast } from 'sonner'

export default function Inventory() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedItemForEdit, setSelectedItemForEdit] = useState(null); // New state

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryAPI.list().then(res => res.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">Track stock levels and manage supplies</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-2xl font-bold mt-1">{items?.length || 0}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Low Stock</p>
                <p className="text-2xl font-bold mt-1 text-red-600">
                  {items?.filter(i => i.current_stock <= i.threshold).length || 0}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Stock</p>
                <p className="text-2xl font-bold mt-1 text-green-600">
                  {items?.filter(i => i.current_stock > i.threshold).length || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader><CardTitle>Inventory Items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">Item</th>
                  <th className="text-left p-4 font-semibold">Current Stock</th>
                  <th className="text-left p-4 font-semibold">Threshold</th>
                  <th className="text-left p-4 font-semibold">Type</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b hover:bg-gray-50 ${
                      item.current_stock <= item.threshold ? 'bg-red-50' : ''
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-semibold ${
                        item.current_stock <= item.threshold ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {item.current_stock} {item.unit}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{item.threshold} {item.unit}</td>
                    <td className="p-4">
                      <Badge variant="secondary">{item.inventory_type}</Badge>
                    </td>
                    <td className="p-4">
                      {item.current_stock <= item.threshold ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          In Stock
                        </Badge>
                      )}
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2 ">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            setSelectedItemForEdit(item);
                          }}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-blue-300 text-black hover:bg-blue-blue-400"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            setSelectedItemForAdjustment(item);
                          }}
                        >
                          Adjust
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {items?.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No inventory items yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateItemModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Adjust Modal */}
      {selectedItem && (
        <AdjustStockModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Edit Modal */}
      {selectedItemForEdit && (
        <EditItemModal 
          item={selectedItemForEdit} 
          onClose={() => setSelectedItemForEdit(null)} 
        />
      )}

    </div>
  )
}

function CreateItemModal({ onClose }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    current_stock: 0,
    threshold: 10,
    inventory_type: 'manual',
    supplier_email: '',
    unit: 'pcs'
  })

  const mutation = useMutation({
    mutationFn: (data) => inventoryAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory'])
      toast.success('Item added')
      onClose()
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <h2 className="text-2xl font-serif font-bold mb-4">Add Inventory Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Item Name</Label>
            <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Current Stock</Label>
              <Input type="number" value={formData.current_stock} onChange={(e) => setFormData({...formData, current_stock: parseInt(e.target.value)})} required />
            </div>
            <div>
              <Label>Threshold</Label>
              <Input type="number" value={formData.threshold} onChange={(e) => setFormData({...formData, threshold: parseInt(e.target.value)})} required />
            </div>
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} placeholder="pcs, kg, liters..." />
          </div>
          <div>
            <Label>Type</Label>
            <select className="w-full mt-1 rounded-md border p-2" value={formData.inventory_type} onChange={(e) => setFormData({...formData, inventory_type: e.target.value})}>
              <option value="manual">Manual</option>
              <option value="auto_deduct">Auto Deduct</option>
            </select>
          </div>
          <div>
            <Label>Supplier Email</Label>
            <Input type="email" value={formData.supplier_email} onChange={(e) => setFormData({...formData, supplier_email: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function AdjustStockModal({ item, onClose }) {
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(0)
  const [type, setType] = useState('manual_add')

  const mutation = useMutation({
    mutationFn: (data) => inventoryAPI.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory'])
      toast.success('Stock adjusted')
      onClose()
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      inventory_item_id: item.id,
      quantity_change: type === 'manual_add' ? quantity : -quantity,
      transaction_type: type,
      notes: `${type} - ${quantity} ${item.unit}`
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
        <h2 className="text-2xl font-serif font-bold mb-4">Adjust Stock: {item.name}</h2>
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">Current Stock</p>
          <p className="text-2xl font-bold">{item.current_stock} {item.unit}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Action</Label>
            <select className="w-full mt-1 rounded-md border p-2" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="manual_add">Add Stock</option>
              <option value="manual_deduct">Remove Stock</option>
            </select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function EditItemModal({ item, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: item.name,
    description: item.description || '',
    threshold: item.threshold,
    unit: item.unit,
    supplier_email: item.supplier_email || ''
  });

  const mutation = useMutation({
    mutationFn: (data) => inventoryAPI.update(item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      toast.success('Item details updated');
      onClose();
    },
    onError: () => toast.error('Failed to update item')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-serif font-bold">Edit Item Details</h2>
          <Badge variant="outline">Current Stock: {item.current_stock}</Badge>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Item Name</Label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              required 
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Threshold</Label>
              <Input 
                type="number" 
                value={formData.threshold} 
                onChange={(e) => setFormData({...formData, threshold: parseInt(e.target.value)})} 
                required 
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input 
                value={formData.unit} 
                onChange={(e) => setFormData({...formData, unit: e.target.value})} 
              />
            </div>
          </div>
          <div>
            <Label>Supplier Email</Label>
            <Input 
              type="email" 
              value={formData.supplier_email} 
              onChange={(e) => setFormData({...formData, supplier_email: e.target.value})} 
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}