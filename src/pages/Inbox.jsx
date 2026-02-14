import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Send, Mail, MessageCircle, Search, Settings, AlertCircle } from 'lucide-react'
import { inboxAPI, emailConnectionAPI } from '../services/api'
import { Card, CardContent, Button, Input, Badge, Skeleton } from '../components/ui'
import { formatDateTime, getInitials } from '../lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function Inbox() {
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => inboxAPI.listConversations().then(res => res.data),
  })

  // Check email connection status
  const { data: emailConnection } = useQuery({
    queryKey: ['email-connection'],
    queryFn: () => emailConnectionAPI.get().then(res => res.data),
    retry: false
  })

  const filteredConversations = conversations?.filter(conv =>
    conv.contact?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header with Email Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">Inbox</h1>
          <p className="mt-1 text-sm text-gray-500">Manage customer conversations</p>
        </div>
        
        {/* Email Connection Status */}
        {emailConnection?.is_active ? (
          <div className="flex items-center gap-3">
            <Badge className="bg-green-100 text-green-700 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              Email Connected: {emailConnection.email}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/email-connection')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => navigate('/settings/email-connection')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="mr-2 h-4 w-4" />
            Connect Email
          </Button>
        )}
      </div>

      {/* Email Not Connected Warning */}
      {!emailConnection?.is_active && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">Connect Your Email</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Connect your email account to receive and reply to customer emails directly from the inbox.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/settings/email-connection')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Connect Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search conversations..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))
              ) : filteredConversations?.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-sm text-gray-500">No conversations yet</p>
                </div>
              ) : (
                filteredConversations?.map((conv, index) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                        selectedConversation?.id === conv.id
                          ? 'bg-white text-primary'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {getInitials(conv.contact?.name || 'U')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold truncate">{conv.contact?.name}</h3>
                          {conv.unread_count > 0 && (
                            <Badge className="bg-red-500 text-white">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm truncate ${
                          selectedConversation?.id === conv.id
                            ? 'text-white/80'
                            : 'text-gray-500'
                        }`}>
                          {conv.messages?.[conv.messages.length - 1]?.content || 'No messages'}
                        </p>
                        {/* Show if from email */}
                        {conv.contact?.source === 'email' && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conversation View */}
        <div className="lg:col-span-2">
          {selectedConversation ? (
            <ConversationView 
              conversation={selectedConversation} 
              emailConnected={emailConnection?.is_active}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Mail className="mx-auto h-16 w-16 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">Select a conversation</h3>
                <p className="mt-2 text-sm text-gray-500">Choose a conversation from the list to view messages</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ConversationView({ conversation, emailConnected }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['conversation', conversation.id],
    queryFn: () => inboxAPI.getConversation(conversation.id).then(res => res.data),
    refetchInterval: 3000,
  })

  const sendMutation = useMutation({
    mutationFn: (content) => inboxAPI.sendMessage(conversation.id, { 
      content, 
      channel: emailConnected ? 'email' : 'internal'  // Use email if connected
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversation', conversation.id])
      queryClient.invalidateQueries(['conversations'])
      setMessage('')
      toast.success(emailConnected ? 'Email sent successfully' : 'Message sent')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to send message')
    }
  })

  const handleSend = (e) => {
    e.preventDefault()
    if (!message.trim()) return
    sendMutation.mutate(message)
  }

  return (
    <Card className="h-[700px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
            {getInitials(conversationData?.contact?.name || 'U')}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">{conversationData?.contact?.name}</h2>
            <p className="text-sm text-gray-500">{conversationData?.contact?.email}</p>
          </div>
          {conversationData?.contact?.source === 'email' && (
            <Badge className="bg-blue-100 text-blue-700">
              <Mail className="h-3 w-3 mr-1" />
              Email Contact
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-3/4" />
            ))}
          </div>
        ) : (
          conversationData?.messages?.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[70%] rounded-lg p-4 ${
                msg.is_from_customer
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-primary text-white'
              }`}>
                {/* Email subject (if exists) */}
                {msg.email_subject && (
                  <p className={`text-xs font-semibold mb-2 pb-2 border-b ${
                    msg.is_from_customer ? 'border-gray-300' : 'border-white/20'
                  }`}>
                    Subject: {msg.email_subject}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <div className={`mt-2 flex items-center gap-2 text-xs ${
                  msg.is_from_customer ? 'text-gray-500' : 'text-white/70'
                }`}>
                  <span>{formatDateTime(msg.created_at)}</span>
                  {msg.channel === 'email' && (
                    <Badge variant="secondary" className="text-xs">
                      <Mail className="h-2 w-2 mr-1" />
                      Email
                    </Badge>
                  )}
                  {msg.is_automated && (
                    <Badge variant="secondary" className="text-xs">Auto</Badge>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        {emailConnected ? (
          <form onSubmit={handleSend} className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
              <Mail className="h-3 w-3" />
              <span>This will be sent as an email to {conversationData?.contact?.email}</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your email reply..."
                className="flex-1"
              />
              <Button type="submit" disabled={sendMutation.isPending || !message.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">Connect your email to send replies</p>
            <Button size="sm" onClick={() => window.location.href = '/settings/email-connection'}>
              <Mail className="h-4 w-4 mr-2" />
              Connect Email
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}