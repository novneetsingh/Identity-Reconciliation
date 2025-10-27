# Identity Reconciliation API

A backend service for identity reconciliation that links customer contact information (email and phone number) across multiple purchases.

## Problem Statement

FluxKart.com needs to identify and link customer identities when the same person uses different contact information across multiple purchases. This API consolidates customer identities and returns all linked contact information.

## Features

- ✅ Create new contact identities
- ✅ Link contacts with matching email or phone numbers
- ✅ Consolidate multiple primary contacts into one identity
- ✅ Handle all edge cases (new contact, existing contact, multiple primaries)
- ✅ Return consolidated contact information with all linked emails and phone numbers

## Tech Stack

- **Node.js** with **TypeScript**
- **Express.js** - Web framework
- **Prisma** - ORM for database management
- **PostgreSQL** - Database

## Database Schema

```prisma
model Contact {
  id                Int            @id @default(autoincrement())
  phoneNumber       String?
  email             String?
  linkedId          Int?
  linkPrecedence    LinkPrecedence // "primary" or "secondary"
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  deletedAt         DateTime?
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/identity_reconciliation"
```

### 3. Run Prisma Migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Start the Server

**Development mode (with auto-reload):**

```bash
npm run dev
```

**Production mode:**

```bash
npm run build
npm start
```

The server will start at `http://localhost:3000`

## API Endpoints

### POST `/identify`

Identifies and consolidates contact information.

#### Request Body

```json
{
  "email": "user@example.com", // Optional (at least one required)
  "phoneNumber": "1234567890" // Optional (at least one required)
}
```

**Note:** At least one of `email` or `phoneNumber` must be provided.

#### Response Format

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com", "user2@example.com"],
    "phoneNumbers": ["1234567890", "9876543210"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Use Cases & Examples

### Case 1: New Contact (No Existing Match)

**Request:**

```json
POST /identify
{
  "email": "alice@example.com",
  "phoneNumber": "1111111111"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["alice@example.com"],
    "phoneNumbers": ["1111111111"],
    "secondaryContactIds": []
  }
}
```

### Case 2: Existing Contact Match

**Request:**

```json
POST /identify
{
  "email": "alice@example.com",
  "phoneNumber": "1111111111"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["alice@example.com"],
    "phoneNumbers": ["1111111111"],
    "secondaryContactIds": []
  }
}
```

### Case 3: New Information for Existing Contact

**Initial State:** Contact exists with email: alice@example.com, phone: 1111111111

**Request:**

```json
POST /identify
{
  "email": "alice@example.com",
  "phoneNumber": "2222222222"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["alice@example.com"],
    "phoneNumbers": ["1111111111", "2222222222"],
    "secondaryContactIds": [2]
  }
}
```

### Case 4: Consolidating Multiple Primary Contacts

**Initial State:**

- Contact 1 (Primary): email: alice@example.com, phone: 1111111111 (created first)
- Contact 2 (Primary): email: bob@example.com, phone: 2222222222 (created later)

**Request:**

```json
POST /identify
{
  "email": "alice@example.com",
  "phoneNumber": "2222222222"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["alice@example.com", "bob@example.com"],
    "phoneNumbers": ["1111111111", "2222222222"],
    "secondaryContactIds": [2]
  }
}
```

**What Happened:** Contact 2 was converted to a secondary contact linked to Contact 1 (the older primary).

## Implementation Details

### Identity Reconciliation Logic

The API handles four main scenarios:

1. **No Existing Contact**: Creates a new primary contact
2. **Exact Match**: Returns existing contact information
3. **New Information**: Creates a secondary contact linking new info to existing identity
4. **Multiple Primaries**: Consolidates by making the oldest contact primary and others secondary

### Key Features

- **Oldest Primary Wins**: When consolidating, the contact created first remains as primary
- **Transitive Linking**: All contacts linked to a demoted primary are re-linked to the new primary
- **Deduplication**: Emails and phone numbers are deduplicated in the response
- **Soft Deletes**: Respects `deletedAt` field to exclude deleted contacts

### Code Structure

```
├── index.ts                          # Main application entry point
├── controllers/
│   └── identity.controllers.ts       # API endpoint logic
├── config/
│   └── prisma.ts                     # Prisma client configuration
├── prisma/
│   └── schema.prisma                 # Database schema
└── generated/
    └── prisma/                       # Generated Prisma client
```
