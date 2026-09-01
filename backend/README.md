# BT System - Banking/Transaction Management API

A production-grade Node.js/Express REST API for secure account and transaction management with atomic MongoDB transactions, JWT-based authentication, and email notifications.

## 🎯 Overview

BT System is a robust financial transaction platform that provides:

- **User Authentication** with JWT tokens and token blacklisting
- **Account Management** with status tracking and multi-currency support
- **Atomic Transactions** with MongoDB sessions for data consistency
- **Ledger System** with immutable transaction records
- **Idempotent API** endpoints to prevent duplicate transactions
- **Email Notifications** for registration and transaction events
- **System User Flow** for initial account funding

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Database Models](#database-models)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Transaction Flow](#transaction-flow)
- [Development](#development)
- [Production Deployment](#production-deployment)

## 🛠 Tech Stack

| Component            | Technology         |
| -------------------- | ------------------ |
| **Runtime**          | Node.js            |
| **Framework**        | Express.js 5.x     |
| **Database**         | MongoDB + Mongoose |
| **Authentication**   | JWT (jsonwebtoken) |
| **Password Hashing** | bcryptjs           |
| **Email**            | Nodemailer         |
| **Development**      | Nodemon            |

## 📁 Project Structure

```
bt-system/
├── src/
│   ├── app.js                      # Express app setup
│   ├── controllers/
│   │   ├── auth.controller.js      # Authentication logic
│   │   ├── account.controller.js   # Account management
│   │   └── transaction.controller.js # Transaction processing
│   ├── models/
│   │   ├── user.model.js           # User schema with auth
│   │   ├── account.model.js        # Account with balance computation
│   │   ├── transaction.model.js    # Transaction records
│   │   ├── ledger.model.js         # Immutable ledger entries
│   │   └── blacklist.model.js      # Token blacklist for logout
│   ├── routes/
│   │   ├── auth.routes.js          # Auth endpoints
│   │   ├── account.routes.js       # Account endpoints
│   │   └── transaction.routes.js   # Transaction endpoints
│   ├── middleware/
│   │   └── auth.middleware.js      # JWT & system user validation
│   ├── services/
│   │   └── email.service.js        # Email notifications
│   └── db/
│       └── db.js                   # MongoDB connection
├── server.js                        # Server entry point
├── package.json                     # Dependencies
└── .env                             # Environment configuration
```

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** >= 18.x
- **MongoDB** >= 5.x (local or Atlas)
- **npm** or **yarn**

### Step 1: Clone & Install

```bash
git clone <repository-url>
cd bt-system
npm install
```

### Step 2: Configure Environment

Create `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/bt-system
# For MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/bt-system

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Email Configuration (Nodemailer)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@bt-system.com
```

### Step 3: Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Step 4: Production Build

```bash
npm start
```

## 📊 Database Models

### User Schema

```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  name: String (required),
  password: String (hashed, required),
  systemUser: Boolean (default: false, immutable),
  createdAt: Date,
  updatedAt: Date
}
```

**Features:**

- Passwords automatically hashed with bcryptjs (10 salt rounds)
- Email validation with regex pattern
- System user flag for initial funding operations
- Timestamps for audit trail

### Account Schema

```javascript
{
  _id: ObjectId,
  userID: ObjectId (ref: User, unique, required),
  status: String (enum: ["ACTIVE", "FROZEN", "CLOSED"]),
  currency: String (default: "INR"),
  createdAt: Date,
  updatedAt: Date
}
```

**Methods:**

- `getBalance()`: Aggregates ledger to compute current balance

**Indexes:**

- `userID` (unique)
- `userID + status` (compound)

### Transaction Schema

```javascript
{
  _id: ObjectId,
  fromAccount: ObjectId (ref: Account, required),
  toAccount: ObjectId (ref: Account, required),
  amount: Number (required, positive),
  status: String (enum: ["PENDING", "COMPLETED", "FAILED", "REVERSED"]),
  idempotencyKey: String (unique, required),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `fromAccount`
- `toAccount`
- `idempotencyKey` (unique)

### Ledger Schema (Immutable)

```javascript
{
  _id: ObjectId,
  account: ObjectId (ref: Account, required),
  amount: Number (required, positive),
  transaction: ObjectId (ref: Transaction, required),
  type: String (enum: ["CREDIT", "DEBIT"]),
  createdAt: Date,
  updatedAt: Date
}
```

**Features:**

- Immutable entries (all modification operations blocked)
- Cannot be updated, deleted, or removed
- Core audit trail for all transactions

### Token Blacklist Schema

```javascript
{
  _id: ObjectId,
  token: String (unique, required),
  createdAt: Date (TTL: 3 days)
}
```

## 🔐 Authentication

### JWT Token Structure

```json
{
  "userID": "...",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**Token Expiry:** 3 days

### Token Delivery Methods

Clients can provide JWT via:

1. **Cookie:** `req.cookies.token`
2. **Authorization Header:** `Authorization: Bearer <token>`

### Middleware Flow

```
Request
  ↓
authMiddleware (or authSystemUserMiddleware)
  ├─ Extract token (cookie or header)
  ├─ Check blacklist
  ├─ Verify JWT signature
  ├─ Fetch user from DB
  ├─ Attach user to req.user
  └─ Call next()
```

## 📡 API Endpoints

### Authentication Routes

#### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securePassword123"
}
```

**Response (201):**

```json
{
  "message": "User registered successfully",
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "6a93c4eae24c95047d9fc54e",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**

```json
{
  "message": "User logged in successfully",
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "6a93c4eae24c95047d9fc54e",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "User logged out successfully",
  "status": "success"
}
```

### Account Routes

#### Create Account

```http
POST /api/account
Authorization: Bearer <token>
Content-Type: application/json

{
  "currency": "INR"
}
```

**Response (201):**

```json
{
  "message": "Account created successfully",
  "account": {
    "_id": "...",
    "userID": "...",
    "status": "ACTIVE",
    "currency": "INR"
  }
}
```

#### Get User Accounts

```http
GET /api/account
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "User accounts retrieved",
  "accounts": [...]
}
```

#### Get Account Balance

```http
GET /api/account/balance/:accountId
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "Account balance retrieved",
  "balance": 5000.0,
  "currency": "INR"
}
```

### Transaction Routes

#### Create Transaction (Normal Transfer)

```http
POST /api/transaction
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccount": "6a93fd1888144968589c2f8d",
  "toAccount": "6a93fd1888144968589c2f9e",
  "amount": 100.50,
  "idempotencyKey": "unique-key-12345"
}
```

**Response (201 - Success):**

```json
{
  "message": "Transaction completed successfully",
  "transaction": {
    "_id": "...",
    "fromAccount": "...",
    "toAccount": "...",
    "amount": 100.5,
    "status": "COMPLETED",
    "idempotencyKey": "unique-key-12345"
  }
}
```

**Response (200 - Duplicate with same idempotencyKey):**

```json
{
  "message": "Transaction is still pending",
  "transaction": { ... }
}
```

**Response (202 - Transient Error):**

```json
{
  "message": "Transaction is pending due to processing delay or temporary failure. Please retry later.",
  "status": "PENDING",
  "details": "Session timeout"
}
```

#### Create Initial Funds (System User Only)

```http
POST /api/transaction/system/initial-funds
Authorization: Bearer <system-user-token>
Content-Type: application/json

{
  "toAccount": "6a93fd1888144968589c2f8d",
  "amount": 10000.00,
  "idempotencyKey": "initial-fund-key"
}
```

**Response (201):**

```json
{
  "message": "Initial funds transaction completed successfully",
  "transaction": { ... }
}
```

## ⚠️ Error Handling

### HTTP Status Codes

| Code    | Meaning                                 | Example                                   |
| ------- | --------------------------------------- | ----------------------------------------- |
| **200** | OK / Duplicate with same idempotencyKey | Existing transaction retrieved            |
| **201** | Created                                 | Transaction completed                     |
| **202** | Accepted (Transient Error)              | Session timeout, DB connectivity          |
| **400** | Bad Request                             | Insufficient balance, validation error    |
| **401** | Unauthorized                            | Missing/invalid token                     |
| **403** | Forbidden                               | Non-system user accessing system endpoint |
| **404** | Not Found                               | Account/user not found                    |
| **409** | Conflict                                | Duplicate idempotencyKey (data issue)     |
| **422** | Unprocessable Entity                    | Email already exists                      |
| **500** | Server Error                            | Permanent transaction failure             |

### Error Classification

The transaction controller intelligently classifies errors:

```
┌─ Not Found (404)
│  └─ "account not found", "CastError"
├─ Validation (400)
│  └─ "Insufficient balance", "ValidationError"
├─ Duplicate (409)
│  └─ "E11000 duplicate", idempotencyKey conflicts
└─ Transient (202)
   └─ Session timeouts, connection issues
```

## 💳 Transaction Flow

### Atomic Transaction with MongoDB Sessions

```
1. Validate Request
   ├─ Check required fields
   └─ Verify accounts exist and are ACTIVE

2. Check Idempotency
   └─ Return existing transaction if idempotencyKey found

3. Validate Balance
   └─ Compute balance from ledger aggregation

4. Start MongoDB Session ← CRITICAL
   └─ Begin transaction

5. Create Records (All or Nothing)
   ├─ Insert transaction record
   ├─ Insert debit ledger entry (from account)
   ├─ Insert credit ledger entry (to account)
   └─ Update transaction status to COMPLETED

6. Commit Session
   └─ Atomically persist all changes

7. Send Emails
   └─ Notify sender and receiver

8. Respond with 201
```

### Idempotency Guarantee

The `idempotencyKey` (unique index) ensures:

- Same request replayed returns **existing transaction** (not a new one)
- Supports safe retries without duplicate transfers
- Works for both normal and system-user transactions

### Pending Response Pattern

If transaction start/processing fails:

```
Try
  └─ Start MongoDB session
      └─ If fails → Catch → Return 202 PENDING

Catch
  └─ Abort transaction safely
  └─ End session
  └─ Return 202 with "Please retry later"
```

This ensures:

- No half-committed transactions
- Safe retry semantics
- Clean session cleanup

## 🔧 Development

### Run Development Server

```bash
npm run dev
```

Starts with nodemon for auto-reload on file changes.

### Project Debugging

#### Check MongoDB Connection

```bash
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✓ DB Connected'))
  .catch(e => console.log('✗ Error:', e.message))
"
```

#### Validate Controller Syntax

```bash
node --check src/controllers/transaction.controller.js
```

#### Inspect Database

```bash
# Using MongoDB CLI
mongosh
> use bt-system
> db.users.findOne()
> db.accounts.find()
> db.transactions.find()
> db.ledgers.find()
```

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (min 32 chars)
- [ ] Configure MongoDB Atlas with IP whitelist
- [ ] Set up email service with SMTP credentials
- [ ] Enable HTTPS on production server
- [ ] Configure CORS properly
- [ ] Use environment-specific .env files
- [ ] Set up monitoring and logging
- [ ] Configure database backups
- [ ] Test transaction flow end-to-end

### Environment Configuration

**Production .env:**

```env
NODE_ENV=production
PORT=3000

MONGO_URI=mongodb+srv://prod-user:password@prod-cluster.mongodb.net/bt-system
JWT_SECRET=$(openssl rand -base64 32)

EMAIL_SERVICE=gmail
EMAIL_USER=your-production-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@production.com
```

### Deployment with PM2

```bash
npm install -g pm2

# Start with PM2
pm2 start server.js --name "bt-system"

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Database Indexes (Production)

Ensure these indexes exist for performance:

```javascript
// Run once in MongoDB
db.users.createIndex({ email: 1 }, { unique: true });
db.accounts.createIndex({ userID: 1 }, { unique: true });
db.accounts.createIndex({ userID: 1, status: 1 });
db.transactions.createIndex({ idempotencyKey: 1 }, { unique: true });
db.transactions.createIndex({ fromAccount: 1 });
db.transactions.createIndex({ toAccount: 1 });
db.ledgers.createIndex({ account: 1 });
db.ledgers.createIndex({ transaction: 1 });
```

### Performance Considerations

1. **Ledger Aggregation:** Balance computation aggregates all ledger entries. For high-volume accounts, consider:
   - Caching balance in Account document
   - Async balance update on transaction completion
   - Separate read replica for balance queries

2. **Transaction Throughput:** MongoDB sessions can become bottleneck under extreme load:
   - Monitor session pool status
   - Adjust connection pool size
   - Consider sharding strategy

3. **Email Sending:** Currently synchronous; consider:
   - Queue system (Bull, Celery)
   - Async background jobs
   - Bulk email service

## 📝 API Testing with Postman

1. **Set JWT Token Variable:**

   ```
   In Collection → Variables:
   - token: (from login response)
   ```

2. **Create Accounts:**
   - POST /api/auth/register
   - POST /api/account

3. **Test Transactions:**
   - Get account IDs from GET /api/account
   - Generate unique idempotencyKey (UUID)
   - POST /api/transaction with both account IDs

4. **Test Idempotency:**
   - Send same request twice with same idempotencyKey
   - Verify second response returns existing transaction

## 📖 Best Practices Implemented

✅ **Atomic Transactions** - MongoDB sessions ensure all-or-nothing semantics  
✅ **Idempotent APIs** - Unique idempotencyKey prevents duplicates  
✅ **Immutable Audit Trail** - Ledger entries cannot be modified  
✅ **Token Blacklist** - Proper logout prevents token reuse  
✅ **Password Security** - bcryptjs with 10 salt rounds  
✅ **Error Classification** - Smart error handling with appropriate HTTP codes  
✅ **Populated References** - Mongoose populate for efficient data fetching  
✅ **Request Validation** - Schema-level validation in models  
✅ **Clean Architecture** - Separation of concerns (controllers, models, services)

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** "Receiver or sender account not found"

- **Cause:** Wrong account ID format or account doesn't exist
- **Fix:** Verify account IDs with GET /api/account

**Issue:** "Insufficient balance"

- **Cause:** Account balance less than transfer amount
- **Fix:** Check balance with GET /api/account/balance/:accountId

**Issue:** "Duplicate transaction (idempotencyKey already exists)"

- **Cause:** Same idempotencyKey used twice with different payload
- **Fix:** Use unique idempotencyKey for each new transaction

**Issue:** "System account not found"

- **Cause:** No account linked to system user
- **Fix:** Create system user manually with flag: `systemUser: true`, then create account for it

**Issue:** "Transaction is pending..." (202 response)

- **Cause:** MongoDB session issue or temporary DB problem
- **Fix:** Retry after a brief delay; check MongoDB connection

## 📄 License

ISC

## 👨‍💻 Author

BT System Development Team
