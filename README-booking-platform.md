# MLM Comedy - Comedian Booking Platform

## Overview
This is a full-stack comedian booking platform built with:
- **Frontend**: HTML/CSS/JavaScript
- **Authentication**: Netlify Identity
- **Backend**: Netlify Functions (serverless)
- **Database**: Firebase Firestore
- **Email**: Resend API

## Features

### Comedian Portal (`/portal.html`)
- Sign up/login with Netlify Identity
- View available gigs with dates, venues, and slot availability
- Request spots for gigs (pending admin approval)
- View "My Gigs" - approved bookings, pending requests, rejected
- Calendar view of upcoming gigs
- Profile management (name, email, phone, bio)

### Admin Dashboard (`/admin.html`)
- Protected admin-only access
- Dashboard overview with statistics
- Create/edit/delete gigs
- View and manage all booking requests (approve/reject)
- Drag-and-drop lineup management
- Send email notifications to comedians
- View all registered comedians

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Firestore Database
4. Go to Project Settings > Service Accounts
5. Generate a new private key (downloads JSON file)
6. You'll need these values for Netlify env vars:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

### 2. Resend Setup (for emails)

1. Go to [Resend](https://resend.com/)
2. Create an account and verify your domain
3. Generate an API key
4. Add to Netlify env vars as `RESEND_API_KEY`

### 3. Netlify Setup

1. Connect your GitHub repo to Netlify
2. Enable Netlify Identity:
   - Go to Site Settings > Identity
   - Click "Enable Identity"
   - Under Registration, choose "Invite only" or "Open"
   - Enable email confirmations

3. Set Environment Variables in Netlify Dashboard:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ADMIN_EMAILS=admin@example.com,another-admin@example.com
   FROM_EMAIL=MLM Comedy <noreply@mlmcomedy.co.nz>
   SITE_URL=https://mlmcomedy.co.nz
   ```

### 4. Firebase Security Rules

Add these Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Comedians collection - users can read/write their own profile
    match /comedians/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth.token.email in ['admin@example.com']; // Add admin emails
    }
    
    // Gigs collection - anyone authenticated can read, only admins can write
    match /gigs/{gigId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.email in ['admin@example.com'];
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.token.email in ['admin@example.com'];
    }
  }
}
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

3. Login to Netlify:
   ```bash
   netlify login
   ```

4. Link to your site:
   ```bash
   netlify link
   ```

5. Run locally:
   ```bash
   netlify dev
   ```

## File Structure

```
mlmcomedy/
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies
├── index.html                # Main website
├── portal.html               # Comedian portal
├── admin.html                # Admin dashboard
├── netlify/
│   └── functions/
│       ├── firebase-init.js  # Firebase initialization
│       ├── getGigs.js        # Fetch all gigs
│       ├── requestGigSpot.js # Request a spot
│       ├── approveBooking.js # Approve/reject bookings
│       ├── getMyGigs.js      # Get comedian's gigs
│       ├── createGig.js      # Create/edit/delete gigs
│       ├── updateLineup.js   # Manage lineup order
│       ├── sendNotification.js # Send emails
│       ├── getBookings.js    # Get all bookings (admin)
│       ├── getComedians.js   # Get all comedians (admin)
│       └── updateProfile.js  # Update comedian profile
```

## API Endpoints

All endpoints are available at `/api/{function-name}`:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/getGigs` | GET | User | Get all upcoming gigs |
| `/api/requestGigSpot` | POST | User | Request a spot on a gig |
| `/api/getMyGigs` | GET | User | Get user's bookings |
| `/api/updateProfile` | GET/POST | User | Get/update profile |
| `/api/getBookings` | GET | Admin | Get all bookings |
| `/api/getComedians` | GET | Admin | Get all comedians |
| `/api/createGig` | POST/PUT/DELETE | Admin | Manage gigs |
| `/api/approveBooking` | POST | Admin | Approve/reject bookings |
| `/api/updateLineup` | POST | Admin | Manage lineup order |
| `/api/sendNotification` | POST | Admin | Send email notifications |

## Email Notifications

The system sends emails for:
- **New gig posted** - Notifies all comedians
- **Booking approved** - Notifies the comedian with gig details
- **Lineup updated** - Notifies affected comedians with their position
- **Gig reminder** - 24-hour reminder to lineup comedians

## Firestore Collections

### `comedians`
```javascript
{
  userId: string,      // Netlify Identity user ID
  name: string,        // Stage name
  email: string,
  phone: string,
  bio: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `gigs`
```javascript
{
  venue: string,
  date: string,        // YYYY-MM-DD
  time: string,        // HH:MM
  slotsTotal: number,
  description: string,
  status: string,      // 'open', 'full', 'completed'
  lineup: [
    {
      comedianId: string,
      comedianName: string,
      comedianEmail: string,
      order: number,
      addedAt: string
    }
  ],
  createdAt: timestamp,
  createdBy: string
}
```

### `bookings`
```javascript
{
  gigId: string,
  comedianId: string,
  comedianEmail: string,
  comedianName: string,
  status: string,      // 'pending', 'approved', 'rejected', 'removed'
  message: string,     // Optional message from comedian
  timestamp: timestamp,
  createdAt: string,
  approvedAt: timestamp,
  approvedBy: string,
  rejectedAt: timestamp,
  rejectedBy: string,
  rejectionReason: string
}
```

## Adding Navigation Links

Add these links to your existing site navigation:

```html
<a href="portal.html" class="nav-item">🎤 Comedian Portal</a>
```

For admin access (hidden from regular users):
```html
<a href="admin.html" class="nav-item">🔐 Admin</a>
```
