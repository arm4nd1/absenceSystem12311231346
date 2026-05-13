# Fingerprint Attendance System

> Final Year Research Project — Full-stack attendance management powered by a **Raspberry Pi Pico W2** + **R307 fingerprint sensor**, a **Python bridge**, **Firebase Firestore**, a **Node.js/Express REST API**, and a **React** dashboard.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  HARDWARE                                                            │
│                                                                      │
│  R307 Sensor ──(UART0)──► Pico W2 ──(UART1/USB)──► PC              │
└─────────────────────────────────────┬────────────────────────────────┘
                                      │ JSON lines (serial)
                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PYTHON BRIDGE  (bridge/bridge.py)                                   │
│  • Reads fingerprint events from serial port                         │
│  • Resolves student by fingerprintId                                 │
│  • Writes attendance documents to Firestore                          │
│  • Exposes HTTP control API on :5050                                 │
└────────┬─────────────────────────────────────────────────────────────┘
         │ Firestore writes                   ▲ REST /session/open|close
         ▼                                    │
┌────────────────┐      ┌─────────────────────┴─────────────────────┐
│   Firebase     │◄────►│  NODE.JS BACKEND  (backend/src/app.js)    │
│   Firestore    │      │  Express REST API on :4000                 │
│   Auth         │      │  Students / Subjects / Attendance / Sess.  │
└────────────────┘      └──────────────────────┬────────────────────┘
                                               │ /api  (proxied)
                                               ▼
                               ┌───────────────────────────┐
                               │  REACT FRONTEND  (:5173)  │
                               │  Dashboard · Students     │
                               │  Subjects · Attendance    │
                               │  Sessions · Reports       │
                               └───────────────────────────┘
```

---

## Directory Structure

```
finger-print/
├── pico/               MicroPython firmware for Raspberry Pi Pico W2
│   ├── config.py       Pin, UART, WiFi, threshold constants
│   ├── r307.py         Full R307/AS608 protocol driver
│   └── main.py         Main firmware loop
│
├── bridge/             Python bridge (PC-side)
│   ├── bridge.py       Serial reader → Firestore writer + HTTP control
│   ├── requirements.txt
│   └── .env.example
│
├── backend/            Node.js + Express REST API
│   ├── src/
│   │   ├── app.js
│   │   ├── config/firebase.js
│   │   ├── middleware/auth.js, errorHandler.js
│   │   ├── controllers/  (auth, students, subjects, attendance, sessions)
│   │   └── routes/       (auth, students, subjects, attendance, sessions)
│   ├── package.json
│   └── .env.example
│
└── frontend/           React + Vite + Tailwind dashboard
    ├── src/
    │   ├── lib/        firebase.js, api.js (axios)
    │   ├── context/    AuthContext.jsx
    │   ├── hooks/      useStudents, useSubjects, useAttendance, useSessions
    │   ├── components/ Layout, Modal, StatusBadge, PageHeader …
    │   └── pages/      Login, Dashboard, Students, Subjects,
    │                   Attendance, Sessions, Reports
    └── .env.example
```

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project.
2. Enable **Authentication** → Email/Password provider.
3. Enable **Firestore Database** → Start in production mode.
4. Create an admin user under Authentication → Users.

### Firestore Security Rules (paste into Firebase Console)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firestore Indexes

The following composite indexes are required (Firebase will prompt you when queries run):

| Collection   | Fields                                   |
|-------------|-------------------------------------------|
| attendance  | `subjectId` ASC, `timestamp` DESC         |
| attendance  | `date` ASC, `timestamp` DESC              |
| attendance  | `subjectId` ASC, `date` ASC               |
| sessions    | `isActive` ASC, `startTime` DESC          |

---

## Hardware Wiring (Pico W2 ↔ R307)

| R307 Pin | Pico W2 Pin | Notes                       |
|----------|-------------|-----------------------------|
| VCC      | 3V3         | 3.3 V power                 |
| GND      | GND         |                             |
| TX       | GP1         | UART0 RX                    |
| RX       | GP0         | UART0 TX                    |

| Signal      | Pico Pin | Notes                        |
|-------------|----------|------------------------------|
| Bridge TX   | GP4      | UART1 RX — to PC USB adapter |
| Bridge RX   | GP5      | UART1 TX — to PC USB adapter |
| Green LED   | GP16     | Present / enrolled indicator |
| Red LED     | GP17     | No match / error indicator   |
| Session Pin | GP15     | Pulled HIGH = session open   |

> You can also use the Pico's native USB serial (UART0 over USB) as the bridge port
> and use a separate UART1 for the R307. Adjust `config.py` accordingly.

---

## Quick Start

### 1 · Firebase credentials

**Backend/Bridge (Service Account)**

1. Firebase Console → Project Settings → Service Accounts → Generate new private key.
2. Save the JSON as `backend/serviceAccountKey.json` **and** `bridge/serviceAccountKey.json`.

**Frontend (Web SDK)**

1. Firebase Console → Project Settings → Web Apps → Add app.
2. Copy the config values.

---

### 2 · Backend

```bash
cd backend
cp .env.example .env        # fill in values
# place serviceAccountKey.json in backend/
npm install
npm run dev
# → http://localhost:4000
```

---

### 3 · Python Bridge

```bash
cd bridge
pip install -r requirements.txt
cp .env.example .env        # set SERIAL_PORT, FIREBASE_CREDENTIALS, etc.
# place serviceAccountKey.json in bridge/
python bridge.py
# → listens on COM3 (serial) and http://localhost:5050 (HTTP control)
```

---

### 4 · Pico W2 Firmware

1. Flash MicroPython on the Pico W2 (≥ v1.23):
   - Hold BOOTSEL → connect USB → drag-drop `RPI_PICO_W-*.uf2`.
2. Copy `pico/config.py`, `pico/r307.py`, `pico/main.py` to the Pico root
   using [Thonny IDE](https://thonny.org/) or `mpremote`.
3. Edit `config.py` with your WiFi credentials and UART pins.

---

### 5 · Frontend

```bash
cd frontend
cp .env.example .env        # fill in Firebase web SDK config
npm install
npm run dev
# → http://localhost:5173
```

---

## API Reference

All routes except `/api/auth/login` and `/api/health` require:
`Authorization: Bearer <jwt_token>`

| Method | Path                              | Description                         |
|--------|-----------------------------------|-------------------------------------|
| POST   | /api/auth/login                   | Exchange Firebase ID token for JWT  |
| GET    | /api/students                     | List all students                   |
| POST   | /api/students                     | Create student                      |
| PUT    | /api/students/:id                 | Update student                      |
| DELETE | /api/students/:id                 | Delete student                      |
| PATCH  | /api/students/:id/fingerprint     | Assign fingerprint slot ID          |
| GET    | /api/subjects                     | List all subjects                   |
| POST   | /api/subjects                     | Create subject                      |
| POST   | /api/subjects/:id/enroll          | Enroll student in subject           |
| POST   | /api/subjects/:id/unenroll        | Unenroll student                    |
| GET    | /api/attendance                   | List attendance (filterable)        |
| GET    | /api/attendance/summary           | Dashboard summary counts            |
| GET    | /api/attendance/report            | Per-student / per-date report       |
| POST   | /api/attendance                   | Manual attendance entry             |
| PATCH  | /api/attendance/:id/status        | Change status                       |
| DELETE | /api/attendance/:id               | Delete record                       |
| POST   | /api/sessions/open                | Open attendance session             |
| POST   | /api/sessions/close               | Close attendance session            |
| GET    | /api/sessions/active              | List active sessions                |
| GET    | /api/sessions/history             | Session history                     |
| POST   | /api/sessions/enroll              | Trigger fingerprint enrollment      |
| POST   | /api/sessions/delete-fp           | Delete fingerprint from sensor      |
| GET    | /api/sessions/bridge              | Bridge health / status              |

---

## Bridge HTTP API (port 5050)

| Method | Path              | Body                    | Description                |
|--------|-------------------|-------------------------|----------------------------|
| GET    | /status           | —                       | Session state              |
| POST   | /session/open     | `{"subjectId":"..."}`   | Open session               |
| POST   | /session/close    | —                       | Close session              |
| POST   | /enroll           | `{"fp_id": 5}`          | Enroll fingerprint slot    |
| POST   | /delete           | `{"fp_id": 5}`          | Delete fingerprint slot    |

---

## Pico ↔ Bridge Serial Protocol

JSON newline-delimited messages at 115200 baud.

**Pico → Bridge**

| Type           | Fields                              |
|----------------|-------------------------------------|
| `ready`        | `ts`                                |
| `scan`         | `fp_id`, `score`, `ts`              |
| `no_match`     | `ts`                                |
| `enroll_ok`    | `fp_id`, `ts`                       |
| `enroll_fail`  | `fp_id`, `reason`, `ts`             |
| `error`        | `reason`, `ts`                      |
| `session_open` | `ts`                                |
| `session_close`| `ts`                                |

**Bridge → Pico**

| `cmd`         | Fields       | Action                        |
|---------------|--------------|-------------------------------|
| `enroll`      | `fp_id`      | Start two-scan enrollment     |
| `delete`      | `fp_id`      | Delete slot from flash        |
| `count`       | —            | Request template count        |
| `clear`       | —            | Wipe entire fingerprint DB    |

---

## Firestore Data Model

```
students/{id}
  name, studentNumber, email, fingerprintId, subjects[], enrolledAt, createdAt

subjects/{id}
  name, code, instructor, schedule, students[], createdAt

attendance/{id}
  studentId, studentName, studentNumber, subjectId,
  fingerprintId, score, timestamp, date, status, manual?

sessions/{id}
  subjectId, startTime, endTime, isActive, date

unknown_scans/{id}
  fingerprintId, score, timestamp, subjectId

enroll_events/{id}
  type, fp_id, ts, serverTime
```

---

## Roles & Permissions

| Feature                        | Admin | Instructor | Student |
|-------------------------------|-------|------------|---------|
| Dashboard                     | ✓     | ✓          | ✓       |
| View own attendance           | ✓     | ✓          | ✓       |
| View/manage all students      | ✓     | view only  | ✗       |
| Create/edit/delete students   | ✓     | ✗          | ✗       |
| Create/edit/delete subjects   | ✓     | ✗          | ✗       |
| Enroll students in subjects   | ✓     | ✗          | ✗       |
| Open/close sessions           | ✓     | own subjects| ✗      |
| Mark attendance status        | ✓     | own subjects| ✗      |
| Attendance reports + export   | ✓     | own subjects| ✗      |
| Fingerprint enrollment/delete | ✓     | ✗          | ✗       |
| User management               | ✓     | ✗          | ✗       |

**First user to sign in automatically becomes Admin.**

---

## Multi-Room / Multi-Pico Setup

Run one `bridge.py` instance per Pico W2 (one per room). Each needs its own `.env`:

```ini
# Room 1 — bridge/.env
SERIAL_PORT=COM3
BRIDGE_HTTP_PORT=5050
BRIDGE_ID=bridge-room1
ROOM_LABEL=Room 101

# Room 2 — bridge/.env.room2
SERIAL_PORT=COM5
BRIDGE_HTTP_PORT=5051
BRIDGE_ID=bridge-room2
ROOM_LABEL=Room 102
```

Run each instance:
```bash
python bridge.py                        # Room 1 (default .env)
python bridge.py --env .env.room2       # Room 2 (or set env vars directly)
```

When opening a session from the dashboard, specify the target bridge URL:
- Room 1 session: opens on `http://localhost:5050`
- Room 2 session: opens on `http://localhost:5051`

All sessions appear simultaneously in the Sessions page.

---

## Email Notifications

When a student is marked **absent** (manually or via status change), an email is automatically
sent to the student's registered email address.

Configure in `backend/.env`:
```ini
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=yourschool@gmail.com
EMAIL_PASS=your_gmail_app_password   # must be an App Password, not your main password
```

Leave `EMAIL_HOST` blank to disable email notifications.

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Hardware  | Raspberry Pi Pico W2, R307 fingerprint sensor   |
| Firmware  | MicroPython                                     |
| Bridge    | Python 3.11+, pyserial, firebase-admin          |
| Backend   | Node.js 20, Express 4, firebase-admin, JWT      |
| Database  | Firebase Firestore                              |
| Auth      | Firebase Authentication                         |
| Frontend  | React 18, Vite 6, Tailwind CSS 4, React Query  |
| Charts    | Recharts                                        |

---

*Built with love for a Final Year Research Project.*
