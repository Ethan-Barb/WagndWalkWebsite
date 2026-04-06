-- ══════════════════════════════════════════════════
-- Wag & Walk — Relational Schema Reference
-- NOTE: The application uses MongoDB (Mongoose ODM).
-- This SQL file is provided as a structural reference only.
-- ══════════════════════════════════════════════════

CREATE TABLE users (
  id            CHAR(24) PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  role          ENUM('client', 'walker', 'admin') DEFAULT 'client',
  phone         VARCHAR(20),
  profile_photo VARCHAR(500),
  is_active     BOOLEAN DEFAULT TRUE,
  is_email_verified BOOLEAN DEFAULT FALSE,
  stripe_customer_id VARCHAR(100),
  address_street VARCHAR(255),
  address_city   VARCHAR(100),
  address_state  VARCHAR(2),
  address_zip    VARCHAR(10),
  address_lat    DECIMAL(10,7),
  address_lng    DECIMAL(10,7),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE walker_profiles (
  user_id          CHAR(24) PRIMARY KEY REFERENCES users(id),
  age              INT,
  bio              TEXT,
  experience       TEXT,
  service_radius   INT DEFAULT 5,
  is_available     BOOLEAN DEFAULT TRUE,
  stripe_account_id VARCHAR(100),
  average_rating   DECIMAL(3,2) DEFAULT 0,
  rating_count     INT DEFAULT 0,
  total_walks      INT DEFAULT 0,
  total_earnings   INT DEFAULT 0,
  total_tips       INT DEFAULT 0
);

CREATE TABLE walker_availability (
  id          CHAR(24) PRIMARY KEY,
  walker_id   CHAR(24) REFERENCES users(id),
  day_of_week TINYINT NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL
);

CREATE TABLE dogs (
  id              CHAR(24) PRIMARY KEY,
  owner_id        CHAR(24) NOT NULL REFERENCES users(id),
  name            VARCHAR(100) NOT NULL,
  breed           VARCHAR(100),
  size            ENUM('small','medium','large','xlarge') NOT NULL,
  age             INT,
  weight          INT,
  gender          ENUM('male','female'),
  color           VARCHAR(50),
  is_neutered     BOOLEAN DEFAULT FALSE,
  is_vaccinated   BOOLEAN DEFAULT FALSE,
  special_instructions TEXT,
  medical_conditions   TEXT,
  feeding_instructions TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id               CHAR(24) PRIMARY KEY,
  client_id        CHAR(24) NOT NULL REFERENCES users(id),
  walker_id        CHAR(24) REFERENCES users(id),
  status           ENUM('pending','accepted','in_progress','completed','cancelled','declined') DEFAULT 'pending',
  scheduled_date   DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  pickup_street    VARCHAR(255),
  pickup_city      VARCHAR(100),
  pickup_state     VARCHAR(2),
  pickup_zip       VARCHAR(10),
  special_instructions TEXT,
  base_price       INT DEFAULT 2000,
  add_on_price     INT DEFAULT 0,
  total_price      INT NOT NULL,
  payment_status   ENUM('pending','paid','refunded','failed') DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(100),
  tip_amount       INT DEFAULT 0,
  tip_paid_at      TIMESTAMP,
  cancelled_by     ENUM('client','walker','admin'),
  cancellation_reason TEXT,
  cancelled_at     TIMESTAMP,
  admin_notes      TEXT,
  accepted_at      TIMESTAMP,
  started_at       TIMESTAMP,
  completed_at     TIMESTAMP,
  paid_at          TIMESTAMP,
  review_rating    TINYINT,
  review_comment   TEXT,
  review_created_at TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE booking_dogs (
  booking_id CHAR(24) REFERENCES bookings(id),
  dog_id     CHAR(24) REFERENCES dogs(id),
  PRIMARY KEY (booking_id, dog_id)
);

CREATE TABLE payments (
  id               CHAR(24) PRIMARY KEY,
  booking_id       CHAR(24) REFERENCES bookings(id),
  client_id        CHAR(24) REFERENCES users(id),
  walker_id        CHAR(24) REFERENCES users(id),
  type             ENUM('walk_payment','tip') NOT NULL,
  amount           INT NOT NULL,
  status           ENUM('pending','succeeded','failed','refunded') DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(100),
  stripe_transfer_id       VARCHAR(100),
  platform_fee_amount      INT DEFAULT 0,
  walker_payout_amount     INT DEFAULT 0,
  processed_at     TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tips (
  id               CHAR(24) PRIMARY KEY,
  booking_id       CHAR(24) REFERENCES bookings(id),
  client_id        CHAR(24) REFERENCES users(id),
  walker_id        CHAR(24) REFERENCES users(id),
  amount           INT NOT NULL,
  stripe_payment_intent_id VARCHAR(100),
  status           ENUM('pending','succeeded','failed') DEFAULT 'pending',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
