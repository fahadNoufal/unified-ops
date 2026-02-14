import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Send, MessageCircle, AlertCircle } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function PublicChat() {
  const { token } = useParams()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [chatInfo, setChatInfo] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initial load
  useEffect(() => {
    loadChatData()
  }, [token])

  // Poll for new messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (chatInfo && !error) {
        loadMessages()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [chatInfo, error])

  const loadChatData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load chat info
      const infoRes = await axios.get(`${API_URL}/api/public/chat/${token}/info`)
      setChatInfo(infoRes.data)

      // Load workspace branding
      const workspaceRes = await axios.get(`${API_URL}/api/public/chat/${token}/workspace`)
      setWorkspace(workspaceRes.data)

      // Load messages
      await loadMessages()

      setLoading(false)
    } catch (err) {
      console.error('Failed to load chat:', err)
      setError(err.response?.data?.detail || 'Failed to load chat. Invalid or expired link.')
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/public/chat/${token}/messages`)
      setMessages(res.data)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim() || sending) return

    if (chatInfo && chatInfo.messages_remaining <= 0) {
      alert('You have reached the maximum of 50 messages.')
      return
    }

    try {
      setSending(true)

      const res = await axios.post(`${API_URL}/api/public/chat/${token}/send`, {
        content: newMessage.trim()
      })

      // Add message to list immediately
      setMessages(prev => [...prev, res.data])

      // Update remaining count
      setChatInfo(prev => ({
        ...prev,
        message_count: prev.message_count + 1,
        messages_remaining: res.data.messages_remaining
      }))

      setNewMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
      alert(err.response?.data?.detail || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to Load Chat</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <div className="w-full max-w-3xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-purple-600 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{workspace?.business_name || 'Chat'}</h1>
              <p className="text-sm text-white/80">
                {chatInfo?.customer_name ? `Chat as ${chatInfo.customer_name}` : 'Customer Chat'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 ">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Start a conversation with {workspace?.business_name}</p>
              <p className="text-sm text-gray-500 mt-2">
                Have any questions? Message us and we'll get back to you soon!
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_from_customer ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow ${
                  message.is_from_customer
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm'
                }`}
              >
                {message.is_automated && (
                  <div className="text-xs opacity-75 mb-1">🤖 Auto-reply</div>
                )}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p className={`text-xs mt-1 ${message.is_from_customer ? 'text-white/70' : 'text-gray-500'}`}>
                  {new Date(message.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          {/* Message limit warning */}
          {chatInfo && chatInfo.messages_remaining <= 10 && chatInfo.messages_remaining > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 text-center">
              ⚠️ You have {chatInfo.messages_remaining} message{chatInfo.messages_remaining !== 1 ? 's' : ''} remaining
            </div>
          )}

          {chatInfo && chatInfo.messages_remaining === 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 text-center">
              ❌ You have reached the maximum of 14 messages. Please contact us directly.
            </div>
          )}

          {/* Input form */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sending || (chatInfo && chatInfo.messages_remaining === 0)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || (chatInfo && chatInfo.messages_remaining === 0)}
              className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="h-5 w-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>

          {/* Footer info */}
          <div className="mt-3 text-center text-xs text-gray-500">
            Powered by {workspace?.business_name || 'Your Business'}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}