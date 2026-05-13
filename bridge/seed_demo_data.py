"""
Demo Data Seeder
================
Creates sample students, subjects, and attendance records directly in
Firestore so you can see a fully populated dashboard immediately.

Run ONCE after setting up Firebase:
  pip install firebase-admin python-dotenv
  python seed_demo_data.py

It will NOT duplicate data if you run it again (checks by studentNumber / subject code).
"""

import os
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, firestore

# ── Init Firebase ─────────────────────────────────────────────────────────────
cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS", "./serviceAccountKey.json"))
firebase_admin.initialize_app(cred, {"projectId": os.getenv("FIREBASE_PROJECT_ID", "")})
db = firestore.client()

# ── Demo data ─────────────────────────────────────────────────────────────────

STUDENTS = [
    {"name": "Maria Santos",     "studentNumber": "2021-00001", "email": "maria@school.edu",    "fingerprintId": 1},
    {"name": "Jose Reyes",       "studentNumber": "2021-00002", "email": "jose@school.edu",     "fingerprintId": 2},
    {"name": "Ana Cruz",         "studentNumber": "2021-00003", "email": "ana@school.edu",      "fingerprintId": 3},
    {"name": "Carlos Dela Torre","studentNumber": "2021-00004", "email": "carlos@school.edu",   "fingerprintId": 4},
    {"name": "Liza Mendoza",     "studentNumber": "2021-00005", "email": "liza@school.edu",     "fingerprintId": 5},
    {"name": "Mark Villanueva",  "studentNumber": "2022-00006", "email": "mark@school.edu",     "fingerprintId": 6},
    {"name": "Grace Tan",        "studentNumber": "2022-00007", "email": "grace@school.edu",    "fingerprintId": 7},
    {"name": "Ryan Ong",         "studentNumber": "2022-00008", "email": "ryan@school.edu",     "fingerprintId": 8},
]

SUBJECTS = [
    {"name": "Software Engineering",  "code": "CS401", "instructor": "Dr. Juan Dela Cruz", "schedule": "MWF 08:00-09:30"},
    {"name": "Database Systems",      "code": "CS302", "instructor": "Prof. Maria Lopez",   "schedule": "TTh 10:00-11:30"},
    {"name": "Computer Networks",     "code": "CS303", "instructor": "Dr. Pedro Santos",    "schedule": "MWF 13:00-14:30"},
]

STATUSES     = ["present", "present", "present", "present", "late", "absent"]
DAYS_HISTORY = 14   # generate 14 days of attendance history

# ── Helpers ───────────────────────────────────────────────────────────────────

def upsert_student(data):
    q = db.collection("students").where("studentNumber", "==", data["studentNumber"]).limit(1).stream()
    docs = list(q)
    if docs:
        print(f"  student already exists: {data['name']}")
        return docs[0].id
    ref = db.collection("students").document()
    now = datetime.now(timezone.utc)
    ref.set({**data, "subjects": [], "enrolledAt": now, "createdAt": now, "updatedAt": now})
    print(f"  created student: {data['name']}  (id={ref.id})")
    return ref.id

def upsert_subject(data):
    q = db.collection("subjects").where("code", "==", data["code"]).limit(1).stream()
    docs = list(q)
    if docs:
        print(f"  subject already exists: {data['name']}")
        return docs[0].id
    ref = db.collection("subjects").document()
    now = datetime.now(timezone.utc)
    ref.set({**data, "students": [], "createdAt": now, "updatedAt": now})
    print(f"  created subject: {data['name']}  (id={ref.id})")
    return ref.id

# ── Main ──────────────────────────────────────────────────────────────────────

def seed():
    print("\n── Creating students ─────────────────────────────────")
    student_ids = [upsert_student(s) for s in STUDENTS]

    print("\n── Creating subjects ─────────────────────────────────")
    subject_ids = [upsert_subject(s) for s in SUBJECTS]

    print("\n── Enrolling students in subjects ────────────────────")
    from firebase_admin.firestore import ArrayUnion
    for sub_id in subject_ids:
        for stu_id in student_ids:
            db.collection("subjects").document(sub_id).update({"students": ArrayUnion([stu_id])})
            db.collection("students").document(stu_id).update({"subjects": ArrayUnion([sub_id])})
    print("  done.")

    print("\n── Generating attendance records ─────────────────────")
    today     = datetime.now(timezone.utc).date()
    att_count = 0

    for day_offset in range(DAYS_HISTORY, 0, -1):
        date = today - timedelta(days=day_offset)
        if date.weekday() >= 5:   # skip weekends
            continue
        date_str = date.isoformat()

        for sub_id, sub_data in zip(subject_ids, SUBJECTS):
            # Create a session record
            session_start = datetime(date.year, date.month, date.day, 8, 0, tzinfo=timezone.utc)
            session_ref   = db.collection("sessions").document()
            session_ref.set({
                "subjectId": sub_id,
                "startTime": session_start,
                "endTime":   datetime(date.year, date.month, date.day, 9, 30, tzinfo=timezone.utc),
                "isActive":  False,
                "date":      date_str,
            })

            for stu_id, stu_data in zip(student_ids, STUDENTS):
                status    = random.choice(STATUSES)
                scan_time = session_start + timedelta(minutes=random.randint(0, 20))

                att_ref = db.collection("attendance").document()
                att_ref.set({
                    "studentId":     stu_id,
                    "studentName":   stu_data["name"],
                    "studentNumber": stu_data["studentNumber"],
                    "subjectId":     sub_id,
                    "fingerprintId": stu_data["fingerprintId"],
                    "score":         random.randint(70, 99),
                    "timestamp":     scan_time,
                    "date":          date_str,
                    "status":        status,
                    "manual":        False,
                })
                att_count += 1

    print(f"  created {att_count} attendance records over {DAYS_HISTORY} days.")
    print("\n✓ Demo data seeding complete!")
    print("  Log into the dashboard to see the populated data.\n")

if __name__ == "__main__":
    seed()
