# ⚡ TypeHaki Arena

### Competitive Typing Tournament Platform for College Students

TypeHaki Arena is a **skill-based competitive typing platform** where users participate in scheduled typing tournaments, compete on leaderboards, and win rewards based on their typing speed and accuracy.

Participants register for competition rounds, pay a small entry fee, take a timed typing challenge, and compete for rankings in a shared prize pool.

The platform transforms typing from simple practice into a **competitive skill-based arena**.

---

# 🌐 Live Demo

Try the deployed platform here:

**https://typehaki-fdba0.web.app/**

---

# 🌍 Vision

Typing is one of the most important digital skills, yet most typing websites only offer practice tools.

TypeHaki Arena introduces a **competitive ecosystem** where typing becomes a measurable skill through tournaments, rankings, and rewards.

The goal is to build a platform where users can:

* improve typing speed through competition
* measure their skill against real participants
* earn rewards through performance

---

# 🧠 Problem Statement

Most typing platforms today focus only on practice.

They lack:

* structured competitions
* performance-based rankings
* identity verification
* incentives for improvement

Students can practice typing, but **they have no platform to compete and prove their skill level**.

---

# 💡 Solution

TypeHaki Arena introduces **scheduled typing tournaments**.

The platform allows users to:

* register for competition rounds
* pay a small entry fee
* participate in a timed typing challenge
* compete on a real-time leaderboard
* win rewards from a shared prize pool

Performance is evaluated using **both typing speed and accuracy**.

---

# ⚙️ Platform Workflow

## 1️⃣ User Registration

Users sign in using **Google Authentication (Firebase)**.

During registration, users provide academic details such as:

* College name
* Branch
* Section
* Roll number
* Mobile number

This ensures **identity verification and prevents duplicate participation**.

---

## 2️⃣ Competition Round Creation

Rounds are created through the **Admin Panel**.

Each round includes:

* Round name
* Registration deadline
* Typing date
* Typing time window
* Entry fee
* Prize pool
* Typing paragraph
* Test duration

Rounds move through lifecycle states:

* Upcoming
* Registration Open
* Active
* Closed

---

## 3️⃣ Round Registration

Users browse available rounds on the dashboard and register.

Registration flow:

1. User fills competition form
2. Duplicate registrations are prevented
3. Entry fee payment is initiated

Once payment succeeds, the user becomes **eligible to participate**.

---

## 4️⃣ Payment System

The platform is designed to integrate with **Razorpay payment gateway**.

Entry fees typically range between:

**₹19 – ₹49**

These contributions collectively form the **competition prize pool**.

(Currently the payment flow is simulated for development.)

---

## 5️⃣ Typing Competition

Participants take a **timed typing test** during the scheduled time window.

Features of the typing engine:

* 60-second typing challenge
* Real-time WPM calculation
* Live accuracy tracking
* Character-by-character feedback
* Automatic submission when time expires

Correct characters appear in **green**, incorrect characters in **red**.

---

## 6️⃣ Performance Evaluation

Each attempt is evaluated using:

* Words Per Minute (WPM)
* Accuracy (%)
* Composite Score

Score Formula:

```
Score = WPM × (Accuracy / 100)²
```

This formula rewards **both speed and precision**.

---

## 7️⃣ Leaderboard System

All participants are ranked based on their score.

Leaderboard displays:

* Rank
* Player Name
* WPM
* Accuracy
* Final Score

Top performers win **rewards from the prize pool**.

---

# 🏗 System Architecture

```
User
 │
 ▼
React Frontend (Typing Engine + UI)
 │
 ▼
Firebase Authentication
 │
 ▼
Cloud Firestore Database
 │
 ▼
Leaderboard & Tournament Data
```

The architecture supports **real-time updates and scalable competition management**.

---

# 🧩 Technology Stack

## Frontend

* React 18
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui (Radix UI components)
* Framer Motion
* React Router DOM

---

## State Management

* TanStack React Query
* Custom Firestore hooks

---

## Backend / Cloud Services

* Firebase Authentication
* Cloud Firestore Database

---

## Visualization

* Recharts

---

## Deployment

* Firebase Hosting

---

# 📂 Database Design

The platform uses four main Firestore collections.

### users

Stores user identity and academic information.

Fields include:

* uid
* email
* name
* avatar
* mobile
* college
* branch
* section
* rollNumber
* role

---

### rounds

Stores competition configuration.

Fields include:

* round name
* registration deadline
* typing date
* time window
* entry fee
* prize pool
* typing text
* duration
* round status

---

### registrations

Stores round participation data.

Fields include:

* roundId
* userId
* student details snapshot
* payment status
* registration timestamp

---

### attempts

Stores competition performance results.

Fields include:

* WPM
* accuracy
* score
* typed text
* start time
* submission time

---

# 🚀 Key Features

* Google authentication login system
* Admin panel for creating typing competitions
* Real-time competition dashboard
* Typing test engine with live WPM calculation
* Leaderboard ranking system
* User profile with competition history
* Secure Firestore database rules
* Responsive UI with dark/light theme
* Animated interface with Framer Motion

---

# 🔐 Security Model

Authentication uses **Firebase Google Sign-In**.

Firestore security rules ensure:

* users can read and update only their own data
* admins can manage rounds and registrations
* attempts are created only by the participant
* sensitive operations require admin privileges

---

# ⚠️ Features Under Development

The following improvements are planned:

* Razorpay payment gateway integration
* Saving typing attempts to Firestore
* Round-specific typing text during competitions
* Time-window enforcement for typing tests
* Automatic participant count updates
* Payment verification webhooks
* Anti-cheat protections (tab switching detection, copy-paste blocking)
* Rank and earnings calculations
* Email notifications
* Firebase Cloud Functions automation
* Environment variable configuration for Firebase

---

# 🎯 Target Users

TypeHaki Arena is designed for:

* Indian college students
* typing enthusiasts
* competitive learners

The platform promotes **skill-based competition rather than chance-based gaming**.

---

# 🏁 Project Summary

TypeHaki Arena is a **competitive typing tournament platform built with React and Firebase** that allows college students to participate in scheduled typing competitions, compete on leaderboards using WPM and accuracy scores, and win rewards from entry-fee-funded prize pools.

The project demonstrates a **full-stack architecture including authentication, real-time database integration, competition workflows, and leaderboard systems**, with future plans for payment integration, anti-cheat mechanisms, and automated tournament management.
