# Wag & Walk — API Documentation

Base URL: `https://wagandwalk.com/api`  
All authenticated endpoints require: `Authorization: Bearer <JWT>`

---

## Authentication

### POST `/auth/register`
Create a new account.

**Body**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "password": "Password123!",
  "role": "client",
  "phone": "630-555-0100",
  "address": {
    "street": "123 Main St",
    "city": "Naperville",
    "state": "IL",
    "zip": "60540"
  },
  "walkerProfile": {
    "age": 19,
    "bio": "I love dogs!"
  }
}
```

**Response 201**
```json
{ "token": "eyJ...", "user": { "_id": "...", "firstName": "Jane", "role": "client", ... } }
```

---

### POST `/auth/login`
**Body** `{ "email", "password" }`  
**Response 200** `{ "token", "user" }`

---

### GET `/auth/me` 🔒
Returns current authenticated user.  
**Response 200** `{ "user": { ... } }`

---

### PATCH `/auth/update-profile` 🔒
Update firstName, lastName, phone, address, profilePhoto.

---

### POST `/auth/change-password` 🔒
**Body** `{ "currentPassword", "newPassword" }`

---

## Walkers

### GET `/walkers`
List available walkers (public).  
**Query** `available=true&rating=4.5`

**Response 200**
```json
{
  "walkers": [
    {
      "_id": "...",
      "firstName": "Emma",
      "walkerProfile": {
        "bio": "...",
        "averageRating": 4.9,
        "totalWalks": 42,
        "availability": [...]
      }
    }
  ]
}
```

---

### GET `/walkers/:id`
Public walker profile + reviews.

---

### GET `/walkers/dashboard` 🔒 walker
**Response** `{ "walker", "upcomingWalks", "pendingWalks" }`

---

### GET `/walkers/earnings` 🔒 walker
**Query** `month=6&year=2025`  
**Response** `{ "earnings": [...], "totals": { "walks", "earnings", "tips" } }`

---

### PATCH `/walkers/profile` 🔒 walker
Update bio, experience, availability, isAvailable, serviceRadius.

---

### POST `/walkers/stripe-connect` 🔒 walker
Returns Stripe Connect onboarding link.  
**Response** `{ "url": "https://connect.stripe.com/..." }`

---

## Clients

### GET `/clients/dashboard` 🔒 client
**Response** `{ "dogs", "upcomingBookings", "recentBookings" }`

---

### GET `/clients/dogs` 🔒 client
### POST `/clients/dogs` 🔒 client

**Body**
```json
{
  "name": "Biscuit",
  "breed": "Golden Retriever",
  "size": "large",
  "age": 3,
  "weight": 65,
  "gender": "male",
  "specialInstructions": "Leash reactive",
  "medicalConditions": "",
  "isNeutered": true,
  "isVaccinated": true
}
```

---

### PATCH `/clients/dogs/:id` 🔒 client
### DELETE `/clients/dogs/:id` 🔒 client
### GET `/clients/payment-history` 🔒 client
### POST `/clients/setup-payment` 🔒 client — Returns Stripe SetupIntent client secret

---

## Bookings

### POST `/bookings` 🔒 client
**Body**
```json
{
  "walkerId": "optional_walker_id",
  "dogIds": ["dog_id_1"],
  "scheduledDate": "2025-07-15",
  "startTime": "10:00",
  "endTime": "11:00",
  "durationMinutes": 60,
  "pickupAddress": {
    "street": "123 Main St",
    "city": "Naperville",
    "state": "IL",
    "zip": "60540"
  },
  "specialInstructions": "Side gate is unlocked"
}
```

**Pricing**  
- 60-min walk: $20 (2000 cents)  
- Each additional dog: +$5 (500 cents)

**Response 201** `{ "booking": { ... } }`

---

### GET `/bookings` 🔒
Returns bookings for current user.  
**Query** `status=pending|accepted|in_progress|completed|cancelled|declined`

---

### GET `/bookings/:id` 🔒
### GET `/bookings/available-slots` 🔒
**Query** `date=2025-07-15&walkerId=optional`  
**Response** `{ "slots": [{ "startTime": "09:00", "endTime": "10:00", "available": true }] }`

---

### PATCH `/bookings/:id/accept` 🔒 walker
### PATCH `/bookings/:id/decline` 🔒 walker — Body: `{ "reason" }`
### PATCH `/bookings/:id/cancel` 🔒 client/walker — Body: `{ "reason" }`
### PATCH `/bookings/:id/complete` 🔒 walker

---

### POST `/bookings/:id/tip` 🔒 client
**Body** `{ "amount": 500 }` (cents)  
Booking must be `completed`. Amount must be > 0.

---

### POST `/bookings/:id/review` 🔒 client
**Body** `{ "rating": 5, "comment": "Excellent walker!" }`  
Booking must be `completed`. One review per booking.

---

## Payments

### POST `/payments/create-intent` 🔒
**Body** `{ "bookingId", "paymentMethodId" }`  
**Response** `{ "clientSecret": "pi_..." }`

---

### GET `/payments/history` 🔒
**Response** `{ "payments": [...] }`

---

### POST `/payments/stripe-connect` 🔒 walker
Returns Stripe Connect onboarding URL.

---

### POST `/payments/webhook`
Stripe webhook endpoint — no auth required, verified via signature.

---

## Admin

All admin endpoints require `role: admin`.

### GET `/admin/dashboard` 🔒 admin
**Response** `{ "userStats", "bookingStats", "revenueStats", "recentBookings", "recentUsers" }`

---

### GET `/admin/analytics` 🔒 admin
**Response** `{ "dailyBookings", "revenueByMonth", "topWalkers" }`

---

### GET `/admin/users` 🔒 admin
**Query** `role=client|walker|admin&search=jane&page=1&limit=20&isActive=true`

---

### PATCH `/admin/users/:id` 🔒 admin
**Body** `{ "isActive": false, "role": "walker" }`

---

### GET `/admin/bookings` 🔒 admin
**Query** `status=pending&date=2025-07-15&page=1&limit=20`

---

### PATCH `/admin/bookings/:id` 🔒 admin
**Body** `{ "status", "adminNotes", "scheduledDate", "startTime", "endTime" }`

---

### DELETE `/admin/bookings/:id` 🔒 admin
Cancels a booking.  
**Body** `{ "reason": "Admin cancelled" }`

---

## Error Format

All errors return JSON:
```json
{ "error": "Human-readable error message" }
```

Common status codes:
- `400` Bad Request — validation error
- `401` Unauthorized — missing or invalid token
- `403` Forbidden — insufficient role
- `404` Not Found
- `409` Conflict — duplicate entry
- `500` Internal Server Error
