# AI-based Packaging Label Compliance Checker

**Smart India Hackathon 2026 - Problem Statement SIH26034**

A complete, production-ready web application for automated packaging label compliance verification using AI-powered OCR and rule-based validation.

## 🚀 Features

### Core Functionality
- **Multi-format Upload**: Drag-and-drop support for PNG, JPG, PDF, WebP, BMP (up to 20MB)
- **AI-powered OCR**: PaddleOCR (primary) with Tesseract fallback, OpenCV preprocessing
- **Compliance Rule Engine**: Regex-based validation for mandatory packaging fields
- **Async Processing**: Celery background jobs with real-time progress updates
- **Professional Reports**: PDF compliance reports with violations, evidence, and OCR text

### Mandatory Fields Validated
| Field | Severity | Description |
|-------|----------|-------------|
| MRP (Maximum Retail Price) | Critical | Price validation with currency detection |
| Net Quantity / Weight | Critical | Weight/volume with unit validation |
| Manufacturer Details | Major | Name and address extraction |
| Best Before / Expiry Date | Major | Multiple date format support |
| Customer Care Contact | Major | Phone/toll-free number validation |
| Packaged Address | Minor | Registered office address |
| FSSAI License Number | Minor | 14-digit license validation |
| Batch / Lot Number | Minor | Traceability code extraction |

### User Roles & Access Control
- **Admin**: Full system access, user management, audit logs, settings
- **Inspector**: Upload scans, view reports, dashboard analytics
- **Auditor**: Read-only access to scans, reports, compliance analytics

### Technical Features
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Comprehensive audit logging
- Rate limiting (API & upload endpoints)
- PostgreSQL with SQLAlchemy ORM + Alembic migrations
- Redis for caching & Celery broker
- Docker Compose orchestration
- Nginx reverse proxy with SSL termination

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│    Nginx    │────▶│   Backend   │
│  (React)    │     │  (Proxy)    │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐            │
                    │  PostgreSQL │◀───────────┘
                    │  (Database) │
                    └─────────────┘
                           │
                    ┌─────────────┐
                    │    Redis    │◀── Celery Broker
                    │  (Cache)    │
                    └─────────────┘
                           │
                    ┌─────────────┐
                    │   Celery    │
                    │  Workers    │──▶ OCR Pipeline
                    └─────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | FastAPI, Python 3.11, SQLAlchemy 2.0, Pydantic v2 |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Database | PostgreSQL 16, Alembic migrations |
| Queue | Celery 5, Redis 7 |
| OCR | PaddleOCR 2.9, OpenCV, Tesseract fallback |
| PDF | ReportLab 4 |
| Storage | Local filesystem / S3-compatible |
| Deployment | Docker Compose, Nginx |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose v2
- 4GB+ RAM (for PaddleOCR models)
- 10GB+ disk space

### 1. Clone & Configure
```bash
git clone <repo-url>
cd packaging-compliance-checker

# Copy environment template
cp .env.example .env

# Edit .env with your settings (especially SECRET_KEY!)
nano .env
```

### 2. Start Services
```bash
# Development (hot reload, Vite on :5173)
docker-compose -f docker-compose.dev.yml up -d --build

# Production (built frontend on :3000)
docker-compose up -d --build
```

Both flows run `python -m app.seed` on the API container start, which creates
the admin and demo users on first run.

### 3. Access Application
- **Frontend (dev)**: http://localhost:5173
- **Frontend (production)**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### 4. Default Credentials
Seeded users:
- **admin** / `Admin@12345` (override with `INIT_ADMIN_PASSWORD`)
- **inspector** / `Inspector@12345`
- **auditor** / `Auditor@12345`

## 📁 Project Structure

```
packaging-compliance-checker/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API routes (REST)
│   │   ├── core/           # Config, security, database, logging
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (OCR, rules, reports)
│   │   ├── tasks/          # Celery background tasks
│   │   └── main.py         # Application factory
│   ├── alembic/            # Database migrations
│   ├── uploads/            # File storage (local)
│   ├── reports/            # Generated PDF reports
│   ├── logs/               # Application logs
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   ├── context/        # React context (auth)
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Helpers
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── nginx/                  # Nginx configuration
├── docker-compose.yml      # Production orchestration
├── .env.example           # Environment template
└── README.md
```

## 🔧 Development

### Backend Development
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.tasks.celery_app worker -Q ocr -l INFO
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Database Migrations
```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## 📖 API Documentation

Interactive API docs available at `/docs` (Swagger UI) and `/redoc` (ReDoc).

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/scans/upload` | Upload label for scanning |
| GET | `/api/v1/scans` | List user's scans |
| GET | `/api/v1/scans/{id}` | Get scan details with violations |
| POST | `/api/v1/scans/{id}/action` | Retry/reprocess scan |
| POST | `/api/v1/reports/{scan_id}/generate` | Generate PDF report |
| GET | `/api/v1/reports/{id}/download` | Download report PDF |
| GET | `/api/v1/dashboard/overview` | Dashboard analytics |
| GET | `/api/v1/users` | List users (admin) |
| GET | `/api/v1/audit-logs` | Audit trail (admin) |

## 🧪 Testing

```bash
# Backend tests (rule engine + OCR pipeline)
cd backend
pytest -v

# Frontend type-check & production build
cd frontend
npm run typecheck
npm run build
```

The backend ships unit tests for the compliance rule engine, OCR line
assembly/pre-processing, and scoring (`backend/tests/`).

## 🔒 Security Considerations

- **HTTPS**: Configure SSL certificates in nginx for production
- **Secrets**: Never commit `.env` files; use Docker secrets or vault
- **File Validation**: Strict MIME type and size validation before processing
- **Rate Limiting**: Configured per endpoint (configurable via env)
- **Audit Trail**: All actions logged with user, IP, timestamp
- **CORS**: Restricted to configured origins

## 📊 Monitoring & Logs

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f celery_worker

# Health checks
curl http://localhost:8000/health

# Metrics (add Prometheus exporter for production)
```

## 🚀 Production Deployment

### 1. Environment Setup
```bash
# Generate strong secret
openssl rand -hex 32

# Update .env with production values
APP_ENV=production
DEBUG=false
SECRET_KEY=<generated-secret>
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
CORS_ORIGINS=https://yourdomain.com
```

### 2. SSL Certificates
```bash
# Place certificates in nginx/ssl/
# Update nginx/nginx.conf for HTTPS
```

### 3. Scale Workers
```yaml
# docker-compose.yml
celery_worker:
  deploy:
    replicas: 4
    resources:
      limits:
        memory: 2G
```

### 4. Backup Strategy
```bash
# Database backup
docker-compose exec postgres pg_dump -U label_user label_compliance > backup.sql

# Uploads backup
tar -czf uploads_backup.tar.gz backend/uploads/
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PaddleOCR** team for excellent OCR engine
- **FastAPI** for the modern Python web framework
- **React** & **Tailwind CSS** for the frontend stack
- **Smart India Hackathon** for the problem statement

## 📞 Support

For issues and feature requests, please open a GitHub issue or contact the development team.

---

**Built for Smart India Hackathon 2026 - SIH26034**