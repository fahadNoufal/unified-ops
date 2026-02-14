# 🎯 Unified Operations Platform - Frontend

A comprehensive operations management system for service-based businesses built with React, featuring real-time updates, AI-powered customer support, and automated workflows.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Pages & Routes](#pages--routes)
- [Key Features](#key-features)
- [Configuration](#configuration)
- [Development](#development)
- [Build & Deployment](#build--deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🎯 Overview

This is the frontend application for a unified operations platform designed for service-based businesses (spas, salons, clinics, fitness centers, consulting, etc.). It provides a complete solution for managing bookings, customers, communications, and business operations.

### What It Does

- **Customer Management**: Track leads, contacts, and customer interactions
- **Booking System**: Manage appointments with calendar views
- **AI Assistant**: Automated customer support with RAG-powered responses
- **Email Automation**: Send welcome emails, confirmations, and reminders
- **Inbox System**: Centralized messaging with customers
- **Inventory Tracking**: Monitor supplies and stock levels
- **Analytics**: Dashboard with business insights
- **Public Forms**: Customer-facing forms and booking pages

---

## ✨ Features

### 🤖 AI-Powered
- **AI Sales Assistant**: Automatically responds to customer inquiries 24/7
- **RAG (Retrieval-Augmented Generation)**: Answers based on your business information
- **Sales-Focused Responses**: Motivates customers to book appointments
- **14 Message Limit**: Per customer to encourage booking

### 📧 Email Automation
- **Welcome Emails**: Automatically sent to new customers
- **Booking Confirmations**: Sent when appointments are made
- **Reminders**: Reduce no-shows with automated reminders
- **Custom Templates**: Personalize emails with your branding

### 🔄 Real-Time Updates
- **Auto-Refresh**: Data updates every 3 seconds
- **Live Updates**: See new bookings, messages, and forms instantly
- **No Page Refresh**: Seamless experience without manual reloads

### 💬 Communication
- **Unified Inbox**: All customer messages in one place
- **Public Chat**: Customers can message you from welcome emails
- **Conversation History**: Full chat history with each customer
- **AI Auto-Reply**: Optional automated responses

### 📊 Business Management
- **Dashboard**: Key metrics and recent activity
- **Booking Calendar**: Visual calendar with drag-and-drop
- **Customer Profiles**: Detailed customer information
- **Inventory Tracking**: Monitor supplies and stock levels
- **Analytics**: Business insights and trends

### 🎨 User Experience
- **Story-Driven Onboarding**: Engaging setup process
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Animations**: Smooth transitions and interactions
- **Toast Notifications**: Non-intrusive feedback

---

## 🛠️ Tech Stack

### Core
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing

### State Management & Data Fetching
- **TanStack Query (React Query)** - Server state management
- **Axios** - HTTP client

### UI Components & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Re-usable component library
- **Radix UI** - Headless component primitives
- **Lucide React** - Icon library
- **Framer Motion** - Animation library

### Notifications
- **Sonner** - Toast notifications

### Utilities
- **date-fns** - Date manipulation
- **clsx** - Conditional classNames

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/yarn/pnpm
- **Backend API** running (see backend README)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment**
   ```env
   # .env
   VITE_API_URL=http://localhost:8000
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:5173
   ```

---

## 📁 Project Structure

```
frontend/
├── public/                   # Static assets
├── src/
│   ├── components/          # Reusable components
│   │   ├── ui/             # shadcn/ui components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   └── ...
│   │   ├── layout/         # Layout components
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Header.jsx
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Bookings.jsx
│   │   ├── Leads.jsx
│   │   ├── Inbox.jsx
│   │   ├── Settings.jsx
│   │   ├── Onboarding.jsx
│   │   ├── PublicChat.jsx
│   │   └── ...
│   ├── services/           # API services
│   │   ├── api.js         # Axios instance & API calls
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── App.jsx            # Root component
│   ├── main.jsx           # Entry point
│   └── index.css          # Global styles
├── .env                   # Environment variables
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## 🗺️ Pages & Routes

### Public Routes (No Authentication)

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `Login.jsx` | User login page |
| `/register` | `Register.jsx` | New user registration |
| `/chat/:token` | `PublicChat.jsx` | Customer chat interface |
| `/book/:workspaceId` | `PublicBooking.jsx` | Public booking page |
| `/forms/:slug/:formId` | `PublicForm.jsx` | Public form submission |

### Protected Routes (Authentication Required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `Dashboard.jsx` | Main dashboard with stats |
| `/onboarding` | `Onboarding.jsx` | Initial setup wizard (9 steps) |
| `/bookings` | `Bookings.jsx` | All bookings list |
| `/bookings/today` | `TodaysBooking.jsx` | Today's appointments |
| `/bookings/:id` | `BookingDetails.jsx` | Booking details |
| `/leads` | `Leads.jsx` | Customer contacts |
| `/leads/:id` | `LeadDetails.jsx` | Customer profile |
| `/inbox` | `Inbox.jsx` | Messages and conversations |
| `/forms` | `Forms.jsx` | Form management |
| `/services` | `Services.jsx` | Service offerings |
| `/inventory` | `Inventory.jsx` | Inventory tracking |
| `/settings` | `Settings.jsx` | Settings (with Email Integration tab) |
| `/analytics` | `Analytics.jsx` | Business analytics |

---

## 🔑 Key Features

### 1. Auto-Refresh (Real-Time Updates)

All pages with dynamic data auto-refresh every 3 seconds using React Query:

```javascript
// Example: Bookings.jsx
const { data: bookings, isFetching } = useQuery({
  queryKey: ['bookings'],
  queryFn: bookingsAPI.list,
  refetchInterval: 3000,  // Auto-refresh every 3 seconds
  refetchIntervalInBackground: false  // Pause when tab inactive
})
```

**Pages with auto-refresh:**
- ✅ Dashboard (stats, recent activity)
- ✅ Bookings (all bookings, today's bookings)
- ✅ Inbox (conversations, messages)
- ✅ Leads (contact list)
- ✅ Forms (submissions)

**Benefits:**
- No manual page refresh needed
- See new bookings/messages instantly
- Reduced server load (pauses when tab inactive)
- Seamless user experience

### 2. AI Assistant Setup (Onboarding Step 2)

During onboarding, users can set up an AI sales assistant:

**5 Questions for RAG Knowledge Base:**
1. **About Your Business** (Required) - What you do, who you serve, what makes you unique
2. **Services & Pricing** - All services with details, duration, pricing
3. **Booking & Scheduling** - Hours, policies, cancellation rules
4. **Policies & Guidelines** - Refunds, payments, safety standards
5. **Practical Information** - Location, parking, contact, FAQs

**How it works:**
```javascript
// All 5 answers combined into rag_content
const ragContent = `
ABOUT THE BUSINESS:
${businessDescription}

SERVICES & PRICING:
${servicesAndPricing}

BOOKING & SCHEDULING:
${bookingAndScheduling}

POLICIES & GUIDELINES:
${policiesAndGuidelines}

PRACTICAL INFORMATION:
${practicalInformation}
`

// Sent to backend → Creates vector store → AI uses for responses
```

**Features:**
- ✅ Optional setup (can skip)
- ✅ Collapsible sections for easy navigation
- ✅ Link to get free Gemini API key
- ✅ Can use system default API key
- ✅ Edit later in Settings

### 3. Public Chat System

Customers can message businesses via secure token links sent in welcome emails:

**Features:**
- 🔐 Token-based authentication (no login required)
- 💬 14 message limit per customer
- 🔄 Auto-refresh every 2 seconds
- 🤖 AI auto-responses (if enabled)
- 📊 Full visibility in business inbox
- 📱 Mobile responsive
- ✉️ Included in welcome emails

**Flow:**
```
1. Customer signs up → Gets welcome email
2. Email contains "💬 Message Us" button
3. Opens chat with unique token
4. Sends message (up to 14 total)
5. AI responds automatically (optional)
6. Business sees in Inbox
7. Business can reply manually
8. Customer sees replies in real-time
```

### 4. Story-Driven Onboarding (9 Steps)

Engaging, validated onboarding process:

**Steps:**
1. **Welcome & Basic Info** - Name, business, industry, contact (validated)
2. **AI Assistant** - Optional AI setup with 5 questions
3. **Email Integration** - Connect Resend for automation (optional)
4. **Contact Form** - Auto-created default form
5. **First Service** - Add initial service offering
6. **Availability** - Set working hours for each day
7. **Inventory** - Info about inventory tracking (optional)
8. **Email Templates** - Auto-created templates
9. **Demo Data** - Generate sample data for testing (optional)

**Features:**
- ✅ Animated progress bar with icons
- ✅ Validation on required fields
- ✅ Can't proceed without required info
- ✅ Skip buttons on optional steps
- ✅ Educational content for each feature
- ✅ Industry dropdown (9 options)
- ✅ Smooth animations and transitions
- ✅ Mobile responsive

### 5. Email Automation

Automated emails triggered by business events:

**Email Types:**
- **Welcome Email**: Sent when new contact created
  - Includes welcome form link
  - Includes booking link
  - Includes **chat link** for messaging
- **Booking Confirmation**: Sent when booking made
  - Appointment details
  - Cancellation policy
- **Booking Reminder**: Sent 24 hours before appointment
  - Reminder with details
  - Link to reschedule
- **Form Reminder**: Sent if form not completed
  - Link to complete form

**Setup:**
- Configure Resend API key in onboarding or Settings
- Edit templates in Settings → Email Templates
- Customize subject, content, variables
- Test emails before sending

**Variables available:**
- `{{customer_name}}`
- `{{business_name}}`
- `{{booking_date}}`
- `{{booking_time}}`
- `{{service_name}}`
- `{{chat_url}}` - Link to customer chat

### 6. Settings with Email Integration Tab

Comprehensive settings page with sidebar navigation:

**Tabs:**
- 📋 **General Settings** - Business info, timezone, hours
- 📧 **Email Integration** - Connect Gmail/Outlook (NEW!)
- 📝 **Email Templates** - Customize email templates
- ⏰ **Availability** - Set working hours

**Email Integration Features:**
- 📖 Setup instructions for Gmail & Outlook
- 🎯 Visual provider selection (cards)
- 📧 Email & App Password input
- ⚙️ Advanced IMAP/SMTP settings (collapsible)
- 🧪 Test connection before saving
- ✅ Connection status display
- 🔄 Manual sync trigger
- ❌ Easy disconnect option
- 🔄 Background syncing every 5 minutes

**How to connect:**
1. Go to Settings → Email Integration
2. Select Gmail or Outlook
3. Enter email and App Password
4. Click "Test Connection" (optional)
5. Click "Save & Start Syncing"
6. ✅ Done! Emails sync automatically

---

## ⚙️ Configuration

### Environment Variables

```env
# .env

# API Configuration
VITE_API_URL=http://localhost:8000
# Production: https://api.yourdomain.com

# App Configuration
VITE_APP_NAME=Unified Operations
```

### API Configuration

Edit `src/services/api.js` to customize API client:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### Tailwind Customization

Customize theme in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',  // Change this
          // ... other shades
        },
      },
    },
  },
}
```

---

## 💻 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Adding Auto-Refresh to a Page

```javascript
import { useQuery } from '@tanstack/react-query'

function MyPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['my-data'],
    queryFn: myAPI.getData,
    refetchInterval: 3000,  // ← Add this
    refetchIntervalInBackground: false  // ← Add this
  })
  
  return (
    <div className="relative">
      {/* Optional: refresh indicator */}
      {isFetching && !isLoading && (
        <div className="absolute top-4 right-4 text-sm text-gray-600">
          <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse inline-block mr-2" />
          Updating...
        </div>
      )}
      
      {/* Your content */}
      {data?.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  )
}
```

### Adding a New Page

1. **Create component**: `src/pages/NewPage.jsx`
2. **Add route**: In `src/App.jsx`
3. **Add nav link**: In `src/components/layout/Sidebar.jsx`

---

## 🏗️ Build & Deployment

### Production Build

```bash
npm run build
# Output: dist/ folder
```

### Deployment Options

#### Vercel
```bash
vercel
vercel --prod
```

#### Netlify
```bash
netlify deploy
netlify deploy --prod
```

#### Docker
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "Cannot connect to API"**
```bash
# Check .env
VITE_API_URL=http://localhost:8000

# Verify backend running
curl http://localhost:8000/api/health
```

**2. "Auto-refresh not working"**
```javascript
// Make sure refetchInterval is added
refetchInterval: 3000
```

**3. "Animations not working"**
```bash
npm install framer-motion
```

**4. "Build fails"**
```bash
rm -rf node_modules .vite dist
npm install
npm run build
```

---

## 📚 Documentation

- [Backend README](../backend/README.md)
- [API Documentation](../docs/API.md)
- [Auto-Refresh Guide](./docs/AUTO_REFRESH_GUIDE.md)
- [AI Agent Setup](./docs/AI_AGENT_SETUP.md)
- [Email Integration](./docs/EMAIL_INTEGRATION.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🆘 Support

- **Documentation**: Check README and docs
- **Issues**: Open GitHub issue
- **Email**: support@yourdomain.com

---

## ✨ Acknowledgments

- React, Vite, Tailwind CSS
- shadcn/ui components
- Lucide React icons
- Framer Motion animations
- TanStack Query

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Dashboard with real-time stats
- ✅ Booking management with calendar
- ✅ Customer/lead tracking
- ✅ AI assistant with RAG
- ✅ Email automation
- ✅ Public chat system
- ✅ Auto-refresh every 3 seconds
- ✅ Story-driven onboarding (9 steps)
- ✅ Email integration (Gmail/Outlook)
- ✅ Inventory tracking
- ✅ Forms management
- ✅ Settings with tabs

### Future Plans
- [ ] Dark mode
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Calendar integrations
- [ ] Payment processing

---

**Happy coding! 🚀**