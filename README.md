# Unified Operations Platform - Backend

Complete FastAPI backend for the Unified Operations Platform.

## Features

- ✅ Complete authentication system (JWT)
- ✅ Workspace onboarding flow
- ✅ Dashboard with real-time metrics
- ✅ Contact & lead management
- ✅ Service & booking system
- ✅ Custom form builder
- ✅ Inventory tracking with alerts
- ✅ Inbox & messaging system
- ✅ Staff management
- ✅ Email integration (Resend)
- ✅ Automated workflows
- ✅ Public API endpoints
- ✅ Dummy data generator

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Auth**: JWT with bcrypt
- **Email**: Resend
- **Validation**: Pydantic

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env` file and update with your credentials:

```bash
cp .env .env.local
```

**Required configurations:**
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Random secret key for JWT
- `RESEND_API_KEY`: Get from resend.com (optional for demo)

### 3. Setup Database

Make sure PostgreSQL is running, then:

```bash
# Create database
createdb unified_ops_db

# Or using psql
psql -U postgres -c "CREATE DATABASE unified_ops_db;"
```

### 4. Run the Server

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the main file
python app/main.py
```

The API will be available at:
- API: http://localhost:8000
- Interactive Docs: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Workspace
- `GET /api/workspaces/me` - Get workspace
- `PUT /api/workspaces/me` - Update workspace
- `POST /api/workspaces/activate` - Activate workspace
- `POST /api/workspaces/generate-dummy-data` - Generate demo data
- `POST /api/workspaces/test-email` - Test email integration

### Dashboard
- `GET /api/dashboard` - Get dashboard metrics

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/{id}` - Get contact

### Services
- `GET /api/services` - List services
- `POST /api/services` - Create service
- `GET /api/services/{id}` - Get service
- `PUT /api/services/{id}` - Update service

### Bookings
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/{id}` - Get booking
- `PUT /api/bookings/{id}` - Update booking

### Forms
- `GET /api/forms` - List form templates
- `POST /api/forms` - Create form template
- `GET /api/forms/{id}` - Get form
- `GET /api/form-submissions` - List submissions

### Inventory
- `GET /api/inventory` - List inventory items
- `POST /api/inventory` - Create item
- `GET /api/inventory/{id}` - Get item
- `PUT /api/inventory/{id}` - Update item
- `POST /api/inventory/transactions` - Record transaction

### Inbox
- `GET /api/conversations` - List conversations
- `GET /api/conversations/{id}` - Get conversation
- `POST /api/conversations/{id}/messages` - Send message

### Staff
- `GET /api/staff` - List staff members
- `POST /api/staff` - Create staff member
- `DELETE /api/staff/{id}` - Delete staff

### Email Templates
- `GET /api/email-templates` - List templates
- `POST /api/email-templates` - Create template
- `PUT /api/email-templates/{id}` - Update template

### Public Endpoints (No Auth)
- `POST /api/public/leads/{slug}` - Capture lead
- `GET /api/public/workspaces/{slug}` - Get workspace info
- `GET /api/public/services/{slug}` - List public services
- `GET /api/public/availability/{slug}/{service_id}` - Get availability
- `POST /api/public/bookings/{slug}` - Create public booking
- `GET /api/public/forms/{token}` - Get form
- `POST /api/public/forms/{token}/submit` - Submit form

## Database Schema

The backend includes the following tables:

- `users` - User accounts (owners & staff)
- `workspaces` - Business workspaces
- `contacts` - Customer contacts
- `conversations` - Message threads
- `messages` - Individual messages
- `services` - Service types
- `bookings` - Appointments
- `form_templates` - Custom forms
- `form_submissions` - Form responses
- `inventory_items` - Inventory tracking
- `inventory_transactions` - Stock movements
- `email_templates` - Email templates
- `automation_rules` - Automated actions
- `lead_tracking` - Lead journey tracking
- `audit_logs` - System audit trail

## Dummy Data

To populate the database with demo data:

1. Login as owner
2. Navigate to dashboard
3. Toggle "Generate Dummy Data" during onboarding
4. Or call: `POST /api/workspaces/generate-dummy-data`

This creates:
- 15 contacts
- 3 services
- 20 bookings (past, today, future)
- 2 form templates
- 4 inventory items
- 10+ conversations with messages

## Email Integration

### Resend Setup

1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Add to `.env`:
   ```
   RESEND_API_KEY=re_your_actual_api_key
   FROM_EMAIL=noreply@yourdomain.com
   ```
4. Verify domain in Resend dashboard

### Email Features

- Welcome emails with booking links
- Booking confirmations
- Post-booking forms
- Reminders (24hrs before)
- Inventory alerts
- Staff credentials

## Automation System

Automated workflows trigger on events:

- **Lead Captured** → Send welcome email with booking link
- **Booking Created** → Send confirmation + post-booking form
- **24hrs Before** → Send booking reminder
- **48hrs After Form Sent** → Send form reminder
- **Stock Below Threshold** → Alert owner & supplier

## Development Tips

### Running Tests

```bash
pytest tests/
```

### Database Migrations

```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migration
alembic upgrade head
```

### Checking Logs

```bash
tail -f logs/app.log
```

## Deployment

### Docker

```bash
docker build -t unified-ops-backend .
docker run -p 8000:8000 --env-file .env unified-ops-backend
```

### Render/Railway

1. Connect GitHub repository
2. Set environment variables
3. Deploy!

### Neon PostgreSQL

1. Create database at [neon.tech](https://neon.tech)
2. Copy connection string
3. Update `DATABASE_URL` in `.env`

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql $DATABASE_URL
```

### Import Errors

```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Email Not Sending

- Check `RESEND_API_KEY` is set
- Verify domain in Resend dashboard
- Check logs for detailed errors
- For demo: emails are logged instead

## Support

For issues or questions:
1. Check API docs at `/api/docs`
2. Review error logs
3. Contact support team

## License

Proprietary - All rights reserved
