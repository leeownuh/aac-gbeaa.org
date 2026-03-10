# Production-Ready CMS Backend

An enterprise-grade, hardened Express.js CMS backend with comprehensive security features, atomic JSON operations, and in-memory caching.

## Features

### Security
- AES-256-CBC encryption for sensitive data
- JWT authentication with refresh token rotation
- HTTP-only secure cookies
- Account lockout after failed login attempts
- Rate limiting on all routes
- Input validation with express-validator
- Path traversal protection
- Helmet security headers
- Integrity hash verification
- Intrusion detection system

### Data Management
- Atomic JSON writes to prevent corruption
- File locking for concurrent operations
- In-memory cache layer
- Automatic versioning (last 5 versions)
- Daily backup system
- JSON schema validation (AJV)
- Graceful error handling

### File Uploads
- Magic number validation
- MIME type verification
- UUID-based filename generation
- Size limits
- Secure storage outside public directory

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key configuration options:
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret for JWT signing
- `ENCRYPTION_KEY` - Key for AES-256 encryption
- `NODE_ENV` - Environment (production/development)

## Usage

### Start Server

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Create Backup

```bash
npm run backup
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Events
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get event by ID
- `POST /api/events` - Create event (Admin)
- `PUT /api/events/:id` - Update event (Admin)
- `DELETE /api/events/:id` - Delete event (Admin)

### Articles
- `GET /api/articles` - Get all articles
- `GET /api/articles/:id` - Get article by ID
- `POST /api/articles` - Create article (Admin)
- `PUT /api/articles/:id` - Update article (Admin)
- `DELETE /api/articles/:id` - Delete article (Admin)

### Gallery
- `GET /api/gallery` - Get all gallery items
- `POST /api/gallery` - Upload image (Admin)
- `DELETE /api/gallery/:id` - Delete image (Admin)

## Default Credentials

**Warning:** Change default credentials immediately in production!

- Username: `admin`
- Password: `Admin@123456`

## Security Best Practices

1. Never commit `.env` file
2. Use strong JWT secrets (min 32 chars)
3. Enable HTTPS in production
4. Run regular backups
5. Monitor security logs
6. Keep dependencies updated

## Project Structure

```
├── src/
│   ├── config/         # Configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── schemas/        # JSON schemas
│   ├── services/       # Business logic
│   ├── storage/        # Data storage
│   └── utils/          # Utilities
├── tests/              # Test files
├── scripts/            # Utility scripts
├── data/               # Public JSON files
├── backups/            # Backup directory
└── logs/               # Log files
```

## License

ISC