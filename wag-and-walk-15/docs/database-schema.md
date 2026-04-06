# Wag & Walk — Database Schema

All collections stored in MongoDB. ODM: Mongoose.

---

## Users

```
users
├── _id                ObjectId (PK)
├── firstName          String (required)
├── lastName           String (required)
├── email              String (required, unique, lowercase)
├── password           String (bcrypt, required)
├── role               Enum: client | walker | admin  (default: client)
├── phone              String
├── profilePhoto       String (URL)
├── isActive           Boolean (default: true)
├── isEmailVerified    Boolean (default: false)
├── emailVerificationToken  String
├── passwordResetToken      String
├── passwordResetExpiry     Date
├── stripeCustomerId   String
│
├── address            {
│     street, city, state, zip,
│     coordinates: { lat, lng }
│   }
│
└── walkerProfile      {         ← populated only for role=walker
      age              Number
      bio              String
      experience       String
      serviceRadius    Number (miles, default: 5)
      isAvailable      Boolean (default: true)
      stripeAccountId  String (Stripe Connect)
      averageRating    Number (0–5, default: 0)
      ratingCount      Number (default: 0)
      totalWalks       Number (default: 0)
      totalEarnings    Number (cents, default: 0)
      totalTips        Number (cents, default: 0)
      availability     [{ dayOfWeek: 0–6, startTime: HH:MM, endTime: HH:MM }]
    }
```

**Indexes:** email (unique), role, isActive  
**Methods:** `comparePassword(plain)`, `toSafeObject()` (strips password)

---

## Dogs

```
dogs
├── _id                ObjectId (PK)
├── owner              ObjectId → users (required)
├── name               String (required)
├── breed              String
├── size               Enum: small | medium | large | xlarge  (required)
├── age                Number (years)
├── weight             Number (lbs)
├── gender             Enum: male | female
├── color              String
├── isNeutered         Boolean (default: false)
├── isVaccinated       Boolean (default: false)
├── profilePhoto       String (URL)
├── specialInstructions  String
├── medicalConditions    String
├── feedingInstructions  String
├── emergencyContact   { name, phone, relation }
└── veterinarian       { name, clinic, phone, address }
```

**Indexes:** owner

---

## Bookings

```
bookings
├── _id                ObjectId (PK)
├── client             ObjectId → users (required)
├── walker             ObjectId → users
├── dogs               [ObjectId] → dogs (required, min: 1)
│
├── status             Enum: pending | accepted | in_progress |
│                            completed | cancelled | declined
│                      (default: pending)
│
├── scheduledDate      Date (required)
├── startTime          String HH:MM (required)
├── endTime            String HH:MM (required)
├── durationMinutes    Number (default: 60)
│
├── pickupAddress      { street, city, state, zip,
│                        coordinates: { lat, lng } }
├── specialInstructions  String
│
├── basePrice          Number cents (default: 2000 = $20)
├── addOnPrice         Number cents (extra dogs × 500)
├── totalPrice         Number cents (required)
│
├── paymentStatus      Enum: pending | paid | refunded | failed
├── stripePaymentIntentId  String
├── stripeCustomerId       String
│
├── tipAmount          Number cents (default: 0)
├── stripeТipIntentId  String
├── tipPaidAt          Date
│
├── gpsRoute           [{ lat, lng, timestamp }]
│
├── cancelledBy        Enum: client | walker | admin
├── cancellationReason String
├── cancelledAt        Date
├── adminNotes         String
│
├── acceptedAt         Date
├── startedAt          Date
├── completedAt        Date
├── paidAt             Date
│
└── review             {
      rating   Number 1–5
      comment  String
      createdAt Date
    }
```

**Indexes:** client, walker, status, scheduledDate  
**Business rule:** `totalPrice = 2000 + (dogs.length - 1) × 500`

---

## Payments

```
payments
├── _id                ObjectId (PK)
├── booking            ObjectId → bookings (required)
├── client             ObjectId → users
├── walker             ObjectId → users
├── type               Enum: walk_payment | tip
├── amount             Number cents (required)
├── status             Enum: pending | succeeded | failed | refunded
├── stripePaymentIntentId  String
├── stripeTransferId       String (Stripe Connect transfer)
├── platformFeeAmount  Number cents (20% of walk_payment)
├── walkerPayoutAmount Number cents (80% of walk_payment)
└── processedAt        Date
```

---

## Tips (denormalized log)

```
tips
├── _id                ObjectId (PK)
├── booking            ObjectId → bookings
├── client             ObjectId → users
├── walker             ObjectId → users
├── amount             Number cents
├── stripePaymentIntentId  String
└── status             Enum: pending | succeeded | failed
```

---

## Entity Relationships

```
users (client) ──< bookings >── users (walker)
users (client) ──< dogs
dogs ──< bookings.dogs (many-to-many via array)
bookings ──< payments
bookings ──< tips
```

---

## Platform Fee Flow

```
Client pays $20 (2000 cents)
    │
    ├── Platform keeps $4 (20%)
    └── Walker receives $16 (80%) via Stripe Connect transfer

Tip $5 (500 cents)
    └── Walker receives $5 (100%) — no platform fee on tips
```
