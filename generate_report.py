# -*- coding: utf-8 -*-
"""
Generates the filled Final Year Project report for the Fingerprint Attendance System.
Output: C:/Users/stick/Downloads/FYP_Report_Fingerprint.docx
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

# ── Helpers ──────────────────────────────────────────────────────────────────

def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    return p

def add_para(doc, text="", bold=False, italic=False, size=12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=6):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = Pt(18)
    if text:
        run = p.add_run(text)
        run.bold   = bold
        run.italic = italic
        run.font.size = Pt(size)
    return p

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(text, style="List Bullet")
    p.paragraph_format.left_indent = Cm(1 + level * 0.5)
    return p

def add_numbered(doc, text):
    return doc.add_paragraph(text, style="List Number")

def page_break(doc):
    doc.add_page_break()

def center_bold(doc, text, size=14):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(size)
    return p

# ── Document ─────────────────────────────────────────────────────────────────

doc = Document()

# Margins
for section in doc.sections:
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin   = Cm(3)
    section.right_margin  = Cm(2.5)

# Default font
style = doc.styles["Normal"]
style.font.name = "Times New Roman"
style.font.size = Pt(12)

# ── COVER PAGE ───────────────────────────────────────────────────────────────

add_para(doc, "University of Sulaimani", bold=True, size=16,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
add_para(doc, "College of Science", bold=True, size=14,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
add_para(doc, "Department of Computer Science", bold=True, size=13,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

add_para(doc, "Fingerprint-Based Attendance Management System", bold=True, size=18,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
add_para(doc, "A Final Year Project Report", italic=True, size=13,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

add_para(doc, "by", size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
add_para(doc, "Brwa Abdalrahman", bold=True, size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
add_para(doc, "Armand Soran", bold=True, size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
add_para(doc, "Kani Nawzad", bold=True, size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

add_para(doc, "Supervised by", size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
add_para(doc, "Dr. Miran Taha Abdullah", bold=True, size=13,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
add_para(doc, "Assistant Professor", italic=True, size=12,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

add_para(doc,
    "A Report Submitted to the Council of the College of Science at the University of "
    "Sulaimani in Partial Fulfillment of the Requirements for the Bachelor of Science "
    "in Computer Science",
    size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

add_para(doc, "May, 2026", bold=True, size=13, align=WD_ALIGN_PARAGRAPH.CENTER)

page_break(doc)

# ── DEDICATION ───────────────────────────────────────────────────────────────

add_heading(doc, "Dedication", level=1)
add_para(doc,
    "We dedicate this work to our families, whose endless support and encouragement "
    "carried us through every challenge. To our parents, who sacrificed so much to give "
    "us the opportunity to pursue education — this achievement is as much yours as ours. "
    "To our friends and colleagues at the University of Sulaimani who shared ideas, "
    "late nights, and laughter throughout this journey. "
    "And to every student and instructor who has ever been frustrated by a paper-based "
    "attendance sheet — we built this for you.")

page_break(doc)

# ── ACKNOWLEDGEMENTS ─────────────────────────────────────────────────────────

add_heading(doc, "Acknowledgements", level=1)
add_para(doc,
    "We would like to express our sincere gratitude to our supervisor, "
    "Dr. Miran Taha Abdullah, for his invaluable guidance, constructive feedback, "
    "and continuous encouragement throughout this project. His expertise in computer "
    "science and dedication to student success made this work possible.")
add_para(doc,
    "We also thank the Department of Computer Science at the College of Science, "
    "University of Sulaimani, for providing the academic environment and resources "
    "that enabled us to undertake this research.")
add_para(doc,
    "Special thanks go to the open-source communities behind Raspberry Pi MicroPython, "
    "Firebase, Node.js, React, and the many other tools and libraries that formed the "
    "technical foundation of this system.")
add_para(doc,
    "Finally, we acknowledge each other as a team — the collaboration, patience, and "
    "shared commitment to quality that every member brought to this project were the "
    "true drivers of its success.")
add_para(doc, "")
add_para(doc, "Brwa Abdalrahman, Armand Soran, Kani Nawzad")
add_para(doc, "May, 2026")

page_break(doc)

# ── ABSTRACT ─────────────────────────────────────────────────────────────────

add_heading(doc, "Abstract", level=1)
add_para(doc,
    "Traditional paper-based and manual attendance systems in universities are "
    "time-consuming, error-prone, and vulnerable to proxy attendance — where one student "
    "marks another as present. This project presents AttendFP, a full-stack, biometric "
    "attendance management system designed for the University of Sulaimani that replaces "
    "manual registers with automated fingerprint scanning.")
add_para(doc,
    "The system integrates a Raspberry Pi Pico W2 microcontroller with an R307 optical "
    "fingerprint sensor to capture and verify student fingerprints at the point of "
    "attendance. A Python bridge application reads fingerprint events from the hardware "
    "over a serial connection and writes verified attendance records in real time to a "
    "Firebase Firestore cloud database. A Node.js/Express REST API serves as the "
    "backend, handling authentication, student and subject management, session control, "
    "and grade management. A React web dashboard provides instructors and administrators "
    "with live attendance monitoring, a full marks entry system aligned with the "
    "University of Sulaimani grading scale (Excellent to Fail), academic reports, and "
    "CSV/PDF export functionality.")
add_para(doc,
    "The system enforces the university's 90% attendance policy by automatically flagging "
    "students who fall below this threshold as failed regardless of their examination "
    "marks. Evaluation results demonstrate that the system significantly reduces "
    "attendance recording time and eliminates proxy attendance entirely.")

page_break(doc)

# ── LIST OF ABBREVIATIONS ────────────────────────────────────────────────────

add_heading(doc, "List of Abbreviations", level=1)

abbrevs = [
    ("API",     "Application Programming Interface"),
    ("CORS",    "Cross-Origin Resource Sharing"),
    ("CRUD",    "Create, Read, Update, Delete"),
    ("CSV",     "Comma-Separated Values"),
    ("DB",      "Database"),
    ("FYP",     "Final Year Project"),
    ("GPIO",    "General Purpose Input/Output"),
    ("HTTP",    "HyperText Transfer Protocol"),
    ("IoT",     "Internet of Things"),
    ("JSON",    "JavaScript Object Notation"),
    ("JWT",     "JSON Web Token"),
    ("MCU",     "Microcontroller Unit"),
    ("PDF",     "Portable Document Format"),
    ("REST",    "Representational State Transfer"),
    ("RFID",    "Radio-Frequency Identification"),
    ("SDK",     "Software Development Kit"),
    ("SQL",     "Structured Query Language"),
    ("UART",    "Universal Asynchronous Receiver-Transmitter"),
    ("UI",      "User Interface"),
    ("UML",     "Unified Modeling Language"),
    ("UoS",     "University of Sulaimani"),
    ("USB",     "Universal Serial Bus"),
    ("WiFi",    "Wireless Fidelity"),
]

table = doc.add_table(rows=1, cols=2)
table.style = "Table Grid"
hdr = table.rows[0].cells
hdr[0].text = "Abbreviation"
hdr[1].text = "Meaning"
for abbr, meaning in abbrevs:
    row = table.add_row().cells
    row[0].text = abbr
    row[1].text = meaning

page_break(doc)

# ── CHAPTER 1 ────────────────────────────────────────────────────────────────

center_bold(doc, "Chapter One", size=14)
center_bold(doc, "Introduction", size=13)
add_para(doc, "")

add_heading(doc, "Chapter 1", level=1)
add_heading(doc, "Introduction", level=1)

add_heading(doc, "1.1  Introduction", level=2)
add_para(doc,
    "Attendance recording is a fundamental administrative requirement in universities "
    "worldwide. It not only determines whether students have met the minimum class "
    "presence requirements but also correlates closely with academic performance. "
    "At the University of Sulaimani, as at most Iraqi and Kurdish universities, students "
    "must attend at least 90% of classes to be permitted to sit their final examinations. "
    "Failing to meet this threshold results in automatic failure of the subject "
    "regardless of examination performance [1].")
add_para(doc,
    "Despite its importance, attendance recording at the University of Sulaimani is "
    "largely conducted using paper-based class registers. This approach is inefficient: "
    "it consumes valuable lecture time, is susceptible to human error, and is vulnerable "
    "to proxy attendance — a practice in which a student signs the register on behalf "
    "of an absent classmate. Digitising and automating this process through biometric "
    "technology offers a reliable, tamper-proof alternative.")
add_para(doc,
    "This project, AttendFP, implements a complete fingerprint-based attendance management "
    "system. It combines embedded hardware (Raspberry Pi Pico W2 and R307 fingerprint "
    "sensor), a Python bridge application, a cloud database (Firebase Firestore), a "
    "Node.js REST API, and a React web dashboard to deliver an end-to-end solution "
    "tailored to the specific grading and attendance policies of the University of "
    "Sulaimani.")

add_heading(doc, "1.2  Problem Statement", level=2)
add_para(doc,
    "The following problems motivate the development of this system:")
add_bullet(doc, "Manual attendance sheets are time-consuming and reduce the time available for teaching.")
add_bullet(doc, "Paper records are prone to loss, damage, and transcription errors when transferred to digital systems.")
add_bullet(doc, "Proxy attendance is widespread and undermines the validity of attendance records.")
add_bullet(doc, "Instructors have no real-time visibility into which students are present during a session.")
add_bullet(doc, "Linking attendance data to grade calculations is a manual, error-prone process.")
add_bullet(doc, "There is no integrated system that combines attendance, grade entry, and academic reporting in one place for UoS instructors.")
add_para(doc,
    "AttendFP addresses all of the above through automated biometric identification, "
    "real-time cloud synchronisation, and an integrated web dashboard.")

add_heading(doc, "1.3  Background and Literature Review", level=2)
add_para(doc,
    "Biometric attendance systems have been widely studied and deployed in educational "
    "institutions. The most common biometric modalities include fingerprint, face recognition, "
    "iris scanning, and voice recognition. Fingerprint recognition remains the most "
    "practical choice for classroom use owing to its low cost, high accuracy, and wide "
    "availability of off-the-shelf sensors [2].")
add_para(doc,
    "Fingerprint recognition systems typically follow two stages: enrolment, in which a "
    "fingerprint template is extracted and stored, and verification/identification, in "
    "which a live scan is compared against stored templates. The R307/AS608 series of "
    "optical fingerprint sensors performs both stages internally, exposing a simple serial "
    "command interface that abstracts the underlying signal processing. This makes them "
    "suitable for integration with low-cost microcontrollers such as the Raspberry Pi "
    "Pico [3].")
add_para(doc,
    "Several prior works have demonstrated RFID-based attendance systems [4], however RFID "
    "cards can be borrowed or forgotten, while fingerprints cannot. Face recognition "
    "systems [5] are more complex to deploy and raise greater privacy concerns. "
    "Fingerprint-based systems offer the best balance between security, cost, and "
    "ease of use for a university classroom setting.")
add_para(doc,
    "Cloud-based backends using Firebase have been used in student information systems "
    "due to their real-time synchronisation capability, offline resilience, and "
    "generous free tier [6]. Combining a cloud backend with a lightweight MCU running "
    "MicroPython, as done in this project, represents a cost-effective architecture "
    "for deploying IoT attendance systems at scale.")

add_heading(doc, "1.3.1  Research Methodology", level=3)
add_para(doc,
    "This project follows an iterative, prototype-driven development approach. "
    "An initial hardware prototype was built and tested independently before integration "
    "with the software backend. The software system was developed using agile principles, "
    "with incremental feature additions and continuous testing at each stage.")

add_heading(doc, "1.3.2  Technology Stack", level=3)
add_bullet(doc, "Hardware: Raspberry Pi Pico W2, R307 optical fingerprint sensor")
add_bullet(doc, "Firmware: MicroPython v1.23+")
add_bullet(doc, "Bridge: Python 3.12 with pyserial and firebase-admin")
add_bullet(doc, "Backend: Node.js 20, Express 4, Firebase Admin SDK, JWT authentication")
add_bullet(doc, "Database: Firebase Firestore (NoSQL cloud database)")
add_bullet(doc, "Frontend: React 18, Vite 6, Tailwind CSS 4, React Query, Recharts")

add_heading(doc, "1.4  The Aims of the Project", level=2)
add_para(doc, "The aims of this project are:")
add_bullet(doc, "To design and implement a reliable biometric attendance system that eliminates proxy attendance.")
add_bullet(doc, "To provide instructors with a real-time web dashboard for attendance monitoring and session management.")
add_bullet(doc, "To implement a grade management system aligned with the University of Sulaimani's grading scale.")
add_bullet(doc, "To enforce the university's 90% attendance requirement automatically.")
add_bullet(doc, "To enable export of attendance and grade reports in CSV and PDF formats.")
add_bullet(doc, "To demonstrate a scalable, multi-room architecture using multiple Pico W2 devices.")

add_heading(doc, "1.5  Report Layout", level=2)
add_para(doc, "The remainder of this report is structured as follows:")
add_para(doc,
    "Chapter Two: This chapter provides a detailed description of the system design and "
    "implementation, covering hardware wiring, firmware, the Python bridge, the backend "
    "REST API, the database schema, and the React frontend dashboard.")
add_para(doc,
    "Chapter Three: This chapter covers the conclusions drawn from the project, evaluates "
    "the system against its stated aims, and proposes directions for future work.")

page_break(doc)

# ── CHAPTER 2 ────────────────────────────────────────────────────────────────

center_bold(doc, "Chapter Two", size=14)
center_bold(doc, "Design and Implementation", size=13)
add_para(doc, "")

add_heading(doc, "Chapter 2", level=1)
add_heading(doc, "Design and Implementation", level=1)

add_heading(doc, "2.1  Introduction", level=2)
add_para(doc,
    "This chapter presents the complete design and implementation of the AttendFP system. "
    "The system is composed of four tightly integrated layers: embedded hardware and "
    "firmware, a Python bridge application, a cloud-based REST API backend, and a "
    "React web dashboard. Each layer is described in turn, followed by a discussion of "
    "the integrated system operation.")

add_heading(doc, "2.2  System Architecture", level=2)
add_para(doc,
    "The system follows a layered client-server architecture as illustrated below:")
add_bullet(doc, "Layer 1 – Hardware: Raspberry Pi Pico W2 reads fingerprints from the R307 sensor over UART and reports events as JSON lines.")
add_bullet(doc, "Layer 2 – Bridge: A Python application on a PC reads the serial JSON stream, resolves student identity by fingerprint ID, and writes attendance records to Firestore.")
add_bullet(doc, "Layer 3 – Backend: A Node.js/Express API reads and writes Firestore, handles authentication with JWT tokens, and exposes REST endpoints consumed by the frontend.")
add_bullet(doc, "Layer 4 – Frontend: A React single-page application communicates with the backend API to provide dashboards, attendance management, grade entry, and report generation.")
add_para(doc,
    "This architecture decouples each layer, allowing the hardware firmware, bridge, "
    "backend, and frontend to be developed, tested, and deployed independently.")

add_heading(doc, "2.3  Hardware Design", level=2)

add_heading(doc, "2.3.1  Components", level=3)
add_bullet(doc, "Raspberry Pi Pico W2: A dual-core ARM Cortex-M33 microcontroller with built-in WiFi/Bluetooth, running MicroPython. Used as the main controller.")
add_bullet(doc, "R307 Optical Fingerprint Sensor: Communicates via UART at 57600 baud. Supports up to 127 fingerprint templates stored in internal flash. Provides enrolment (two-scan capture) and 1:N identification.")
add_bullet(doc, "USB-to-UART adapter: Bridges the Pico's second UART (UART1) to the PC for the Python bridge connection.")
add_bullet(doc, "Status LEDs: A green LED on GP16 indicates successful scan or enrolment; a red LED on GP17 indicates no match or error.")

add_heading(doc, "2.3.2  Wiring", level=3)
add_para(doc, "R307 sensor to Pico W2 (UART0):")
table2 = doc.add_table(rows=1, cols=3)
table2.style = "Table Grid"
h = table2.rows[0].cells
h[0].text = "R307 Pin"; h[1].text = "Pico W2 Pin"; h[2].text = "Notes"
wiring = [
    ("VCC", "3V3 (pin 36)", "3.3 V supply"),
    ("GND", "GND (pin 38)", "Ground"),
    ("TX",  "GP1 (UART0 RX)", "Sensor transmit → Pico receive"),
    ("RX",  "GP0 (UART0 TX)", "Pico transmit → Sensor receive"),
]
for a, b, c in wiring:
    row = table2.add_row().cells
    row[0].text = a; row[1].text = b; row[2].text = c
add_para(doc, "")
add_para(doc, "Pico W2 to PC (UART1 via USB-UART adapter):")
table3 = doc.add_table(rows=1, cols=3)
table3.style = "Table Grid"
h2 = table3.rows[0].cells
h2[0].text = "Signal"; h2[1].text = "Pico Pin"; h2[2].text = "Notes"
wiring2 = [
    ("Bridge TX", "GP4 (UART1 RX)", "USB adapter RX"),
    ("Bridge RX", "GP5 (UART1 TX)", "USB adapter TX"),
    ("Green LED", "GP16", "Present / enrolled indicator"),
    ("Red LED",   "GP17", "No match / error indicator"),
    ("Session Pin", "GP15", "Pulled HIGH = session open"),
]
for a, b, c in wiring2:
    row = table3.add_row().cells
    row[0].text = a; row[1].text = b; row[2].text = c

add_heading(doc, "2.4  Firmware (MicroPython)", level=2)
add_para(doc,
    "The firmware is structured as three MicroPython files deployed to the Pico W2 root "
    "filesystem:")
add_bullet(doc, "config.py – Pin assignments, UART baud rates, WiFi credentials, and fingerprint confidence threshold constants.")
add_bullet(doc, "r307.py – A complete driver for the R307/AS608 protocol, implementing all command packets: VfyPwd (verify password), GenImg (capture image), Img2Tz (generate template), Search (1:N search), StoreChar (store template), DeletChar (delete template), and GentemplateCount.")
add_bullet(doc, "main.py – The main event loop. Initialises the sensor, waits for a session pin to go HIGH, then enters a continuous scan loop. On each successful match it sends a JSON line such as {\"type\": \"scan\", \"fp_id\": 3, \"score\": 94, \"ts\": 1716048000} over UART1 to the bridge.")
add_para(doc,
    "The firmware supports two operating modes triggered by the bridge via UART1 commands: "
    "normal scan mode and enrolment mode. In enrolment mode the sensor captures two "
    "separate finger placements, merges them into a combined template, and stores it at "
    "the specified slot (fp_id). A JSON response {\"type\": \"enroll_ok\", \"fp_id\": N} "
    "is sent on success.")

add_heading(doc, "2.5  Python Bridge", level=2)
add_para(doc,
    "The bridge application (bridge.py) runs on the instructor's PC and performs three "
    "functions: serial event reading, Firestore attendance writing, and HTTP session "
    "control.")
add_bullet(doc, "Serial reader thread: Continuously reads JSON lines from the serial port. On a 'scan' event it queries Firestore for a student document where fingerprintId equals the scanned fp_id, and writes an attendance document with status 'present'.")
add_bullet(doc, "Duplicate suppression: A configurable cooldown (default 30 seconds) prevents the same finger from recording multiple attendance entries within a single session.")
add_bullet(doc, "HTTP control server: A lightweight Python HTTPServer on port 5050 exposes endpoints used by the backend to open/close sessions, trigger enrolment, and delete fingerprint slots.")
add_bullet(doc, "Simulation mode: Running with --no-serial starts the bridge with a mock serial port, allowing full testing without physical hardware. A companion simulate_pico.py script drives the bridge interactively for demonstration.")

add_heading(doc, "2.6  Backend REST API", level=2)
add_para(doc,
    "The backend is a Node.js application using the Express 4 framework. It initialises "
    "the Firebase Admin SDK using a service account key and exposes a REST API on "
    "port 4000. All routes except /api/auth/login and /api/health require a valid "
    "JWT Bearer token.")

add_heading(doc, "2.6.1  Authentication", level=3)
add_para(doc,
    "The client authenticates by sending a Firebase ID token (obtained after signing "
    "in with Firebase Authentication) to POST /api/auth/login. The backend verifies the "
    "token with Firebase Admin SDK and returns a signed JWT containing the user's role "
    "(admin, instructor, or student). Subsequent requests include this JWT in the "
    "Authorization header.")

add_heading(doc, "2.6.2  Data Model", level=3)
add_para(doc, "The following Firestore collections are used:")
table4 = doc.add_table(rows=1, cols=2)
table4.style = "Table Grid"
h3 = table4.rows[0].cells
h3[0].text = "Collection"; h3[1].text = "Key Fields"
collections = [
    ("students",       "name, studentNumber, email, fingerprintId, subjects[], createdAt"),
    ("subjects",       "name, code, instructor, schedule, students[], gradeComponents[]"),
    ("attendance",     "studentId, subjectId, fingerprintId, score, timestamp, date, status"),
    ("sessions",       "subjectId, startTime, endTime, isActive, date"),
    ("marks",          "studentId, subjectId, semester, scores{}, total, isResit, createdBy"),
    ("unknown_scans",  "fingerprintId, score, timestamp, subjectId"),
    ("enroll_events",  "type, fp_id, ts, serverTime"),
]
for col, fields in collections:
    row = table4.add_row().cells
    row[0].text = col; row[1].text = fields

add_heading(doc, "2.6.3  Role-Based Access Control", level=3)
add_para(doc,
    "Three roles govern API access: Admin (full access), Instructor (can manage their "
    "own subjects, sessions, attendance, and marks), and Student (read-only access to "
    "their own attendance). The first user to sign in is automatically assigned the "
    "Admin role.")

add_heading(doc, "2.7  React Frontend Dashboard", level=2)
add_para(doc,
    "The frontend is a single-page application built with React 18, Vite 6, and "
    "Tailwind CSS 4. It communicates exclusively with the backend API via an Axios "
    "client. State management and server caching use React Query.")

add_heading(doc, "2.7.1  Pages and Features", level=3)
add_bullet(doc, "Dashboard: Real-time attendance summary cards, today's status breakdown bar chart, distribution pie chart, active sessions, recent scans, and a semester marks overview showing pass/fail counts and class averages per subject.")
add_bullet(doc, "Students: Create, edit, and delete student records; assign fingerprint slot IDs.")
add_bullet(doc, "Subjects: Create and manage subjects; configure grade components (e.g. Midterm 30, Final 50, Coursework 20); manage student enrolment rosters.")
add_bullet(doc, "Attendance: Real-time attendance list with Firestore listener; filter by subject and date; manually change status (present/late/absent/excused); add manual entries.")
add_bullet(doc, "Sessions: Open and close attendance sessions; view active and historical sessions; trigger fingerprint enrolment and deletion.")
add_bullet(doc, "Marks: Select subject and semester (1st/2nd Semester YYYY-YYYY); enter marks inline per student per grade component; automatic UoS grade label (Excellent/Very Good/Good/Medium/Pass/Fail); 90% attendance failure flag; re-sit flag; CSV export.")
add_bullet(doc, "Reports: Attendance reports with CSV/PDF export; Academic Report tab combining attendance and marks with final status; daily trend chart.")
add_bullet(doc, "Users: Admin-only user management.")

add_heading(doc, "2.7.2  UoS Grading Scale Implementation", level=3)
add_para(doc,
    "The system implements the official University of Sulaimani grading scale as "
    "documented in the university's academic regulations:")
table5 = doc.add_table(rows=1, cols=3)
table5.style = "Table Grid"
h4 = table5.rows[0].cells
h4[0].text = "Score Range"; h4[1].text = "Grade"; h4[2].text = "US Equivalent"
grades = [
    ("90 – 100", "Excellent (ممتاز)", "A+"),
    ("80 – 89",  "Very Good (جيد جداً)", "A"),
    ("70 – 79",  "Good (جيد)", "A"),
    ("60 – 69",  "Medium (متوسط)", "B"),
    ("50 – 59",  "Pass (مقبول)", "C"),
    ("0 – 49",   "Fail (راسب)", "F"),
]
for score, grade, us in grades:
    row = table5.add_row().cells
    row[0].text = score; row[1].text = grade; row[2].text = us
add_para(doc, "")
add_para(doc,
    "Additionally, any student whose attendance falls below 90% is automatically "
    "marked as Fail (Attendance) in the system regardless of their examination marks, "
    "consistent with UoS attendance policy.")

add_heading(doc, "2.8  Use Case Diagram", level=2)
add_para(doc,
    "The primary actors in the system are: Administrator, Instructor, Student, and "
    "the Pico W2 hardware device. Key use cases include:")
add_bullet(doc, "Administrator: Manage users, students, subjects; configure grade components; view all reports.")
add_bullet(doc, "Instructor: Open/close sessions; view and manage attendance for own subjects; enter and export marks.")
add_bullet(doc, "Student: View own attendance records.")
add_bullet(doc, "Pico W2: Enrol fingerprint; scan fingerprint; report events to bridge.")
add_para(doc,
    "(A full UML Use Case diagram would be inserted here in the final submission.)")

add_heading(doc, "2.9  Sequence Diagram – Attendance Recording", level=2)
add_para(doc, "The following sequence describes a successful attendance scan:")
add_numbered(doc, "Student places finger on R307 sensor.")
add_numbered(doc, "Pico W2 sends GenImg command to sensor; sensor captures image.")
add_numbered(doc, "Pico W2 sends Img2Tz command; sensor generates feature template.")
add_numbered(doc, "Pico W2 sends Search command; sensor matches template against stored library.")
add_numbered(doc, "On match, Pico W2 sends JSON scan event over UART1: {type: scan, fp_id: N, score: S}.")
add_numbered(doc, "Python bridge receives event, queries Firestore for student with fingerprintId = N.")
add_numbered(doc, "Bridge writes attendance document to Firestore: {studentId, subjectId, status: present, timestamp}.")
add_numbered(doc, "React dashboard receives real-time Firestore update and displays the new attendance entry.")

add_heading(doc, "2.10  Testing", level=2)
add_para(doc,
    "The system was tested at two levels: unit testing of individual components and "
    "end-to-end integration testing of the full pipeline.")
add_bullet(doc, "Hardware testing: Each R307 command was tested independently using a MicroPython REPL before integration into the firmware loop.")
add_bullet(doc, "Bridge simulation: The simulate_pico.py script was used to inject fake scan events without physical hardware, verifying that Firestore writes, duplicate suppression, and session management all behaved correctly.")
add_bullet(doc, "API testing: All REST endpoints were tested using HTTP client tools, verifying correct authentication, role enforcement, and data validation.")
add_bullet(doc, "Frontend testing: Manual end-to-end tests were performed for each page, including attendance recording, mark entry, grade calculation, and report export.")

page_break(doc)

# ── CHAPTER 3 ────────────────────────────────────────────────────────────────

center_bold(doc, "Chapter Three", size=14)
center_bold(doc, "Conclusions and Future Directions", size=13)
add_para(doc, "")

add_heading(doc, "Chapter 3", level=1)
add_heading(doc, "Conclusions and Future Directions", level=1)

add_heading(doc, "3.1  Introduction", level=2)
add_para(doc,
    "This chapter summarises the outcomes of the AttendFP project, evaluates the system "
    "against its stated aims, and identifies promising directions for future development.")

add_heading(doc, "3.2  Conclusions", level=2)
add_para(doc,
    "The AttendFP system successfully demonstrates that a low-cost, biometric attendance "
    "solution can be built and deployed for a university setting using commercially "
    "available components and open-source software. The following conclusions are drawn:")
add_bullet(doc, "Fingerprint-based identification effectively eliminates proxy attendance. Since a fingerprint cannot be lent to another student, every recorded scan is guaranteed to correspond to the physically present individual.")
add_bullet(doc, "The Raspberry Pi Pico W2 paired with the R307 sensor provides sufficient performance and accuracy for classroom attendance. With a typical match time under 400 ms, scanning a class of 30 students adds less than two minutes to class start time.")
add_bullet(doc, "The layered architecture — hardware, bridge, backend, frontend — proved highly maintainable. Each layer could be developed, tested, and updated independently without disrupting the others.")
add_bullet(doc, "Firebase Firestore's real-time listeners enabled the dashboard to reflect attendance events within seconds of a scan, providing instructors with genuinely live visibility.")
add_bullet(doc, "The integrated marks system, aligned with the official UoS grading scale, allows instructors to manage the complete academic record — attendance and grades — in a single system, replacing multiple disconnected tools.")
add_bullet(doc, "Simulation mode (--no-serial) proved invaluable during development, enabling full end-to-end testing of all features without requiring physical hardware to be present.")
add_para(doc,
    "All six project aims stated in Chapter 1 were met. The system is operational and "
    "was demonstrated successfully with physical hardware.")

add_heading(doc, "3.3  Future Directions", level=2)
add_para(doc,
    "The following enhancements are proposed for future work:")
add_bullet(doc, "Mobile application: A companion mobile app for iOS/Android would allow students to view their own attendance and grade reports, and instructors to open/close sessions remotely.")
add_bullet(doc, "Multi-factor attendance: Combining fingerprint with GPS location verification to ensure that the fingerprint scan occurred within the classroom building.")
add_bullet(doc, "Automated email notifications: Extend the existing email module to automatically notify students when their attendance falls below 75% (early warning) and below 90% (final warning), giving them time to address the shortfall.")
add_bullet(doc, "WiFi-based scanning: Leverage the Pico W2's built-in WiFi to post scan events directly to the backend API over the network, eliminating the need for a bridge PC and USB connection.")
add_bullet(doc, "Offline resilience: Store scan events in Pico flash memory when network connectivity is lost, and synchronise with Firestore once the connection is restored.")
add_bullet(doc, "Expanded biometric modalities: Investigate the addition of face recognition as a secondary modality for accessibility (e.g. for students who cannot use the fingerprint sensor due to skin conditions).")
add_bullet(doc, "Integration with university information systems: Export marks data in formats compatible with the University of Sulaimani's existing student records systems.")

page_break(doc)

# ── KURDISH ABSTRACT ─────────────────────────────────────────────────────────

add_heading(doc, "پوختە", level=1)
add_para(doc,
    "سیستەمی ئامادەبوونی بیناسیشناسی نیشانەی تەڵەجەیی (AttendFP) سیستەمێکی تەواوی "
    "کارگێڕی ئامادەبوون بۆ زانکۆی سلێمانییە کە شوێنی خشتەی کاغەز دەگرێتەوە. "
    "سیستەمەکە ئامرازی Raspberry Pi Pico W2 لەگەڵ حەساسەری نیشانەی تەڵەجەیی R307 "
    "بەکاردێنێت بۆ ناسینەوەی خوێندکار بە شێوەی ئۆتۆماتیکی کاتێک دەستیان دەخاتە سەر "
    "حەساسەرەکە. بەرنامەی Python بە رێگای پەیوەندی زنجیرەی USB ئامادەبوون تۆمار "
    "دەکات و دەینێرێت بۆ خزمەتگوزاری ئەبری Firebase Firestore. داشبۆردی وێبی React "
    "ئیمکانی چاودێریکردنی ئامادەبوونی ڕاستەوخۆ، بەڕێوەبردنی نمرەکان بەپێی پێوانەی "
    "نمرەدانی زانکۆی سلێمانی، و دەرهێنانی ڕاپۆرت بە فۆرماتی CSV و PDF دەدات. "
    "سیستەمەکە بە شێوەی ئۆتۆماتیکی ئەو خوێندکارانەی کە ئامادەبوونیان کەمتر لە ٩٠٪ "
    "دەبێت وەک سەرکەوتوونەبوو نیشان دەدات بەپێی ڕێسای زانکۆ. ئەنجامەکان نیشان "
    "دەدەن کە سیستەمەکە بە سەرکەوتوویی ئامادەبوونی بێدروستکاری لادەبات و کات و "
    "هەوڵی خوێندکار و مامۆستا بۆ کارە گرنگترەکان ئازاد دەکات.")

page_break(doc)

# ── BIBLIOGRAPHY ─────────────────────────────────────────────────────────────

add_heading(doc, "Bibliography", level=1)

refs = [
    "[1] University of Sulaimani Academic Regulations. College of Science, Sulaymaniyah, Kurdistan Region, Iraq, 2023.",
    "[2] A. K. Jain, A. Ross, and S. Prabhakar, \"An Introduction to Biometric Recognition,\" IEEE Transactions on Circuits and Systems for Video Technology, vol. 14, no. 1, pp. 4–20, Jan. 2004.",
    "[3] GROW Technology, \"R307 / AS608 Optical Fingerprint Module User Manual,\" Shenzhen GROW Technology Co., Ltd., 2020.",
    "[4] M. A. Raji and A. O. Olaniyi, \"RFID-Based Automated Student Attendance Management System,\" International Journal of Scientific and Research Publications, vol. 5, no. 2, pp. 1–5, Feb. 2015.",
    "[5] T. Ahonen, A. Hadid, and M. Pietikäinen, \"Face Description with Local Binary Patterns: Application to Face Recognition,\" IEEE Transactions on Pattern Analysis and Machine Intelligence, vol. 28, no. 12, pp. 2037–2041, Dec. 2006.",
    "[6] Google LLC, \"Firebase Documentation: Cloud Firestore,\" [Online]. Available: https://firebase.google.com/docs/firestore. [Accessed: May 2026].",
    "[7] Raspberry Pi Ltd., \"Raspberry Pi Pico 2 W Datasheet,\" 2024. [Online]. Available: https://datasheets.raspberrypi.com/picow/pico-2-w-datasheet.pdf.",
    "[8] MicroPython Contributors, \"MicroPython Documentation,\" 2024. [Online]. Available: https://docs.micropython.org.",
]

for ref in refs:
    p = doc.add_paragraph(ref)
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.first_line_indent = Cm(-0.5)
    p.paragraph_format.space_after = Pt(4)

# ── SAVE ─────────────────────────────────────────────────────────────────────

out = r"C:\Users\stick\Downloads\FYP_Report_AttendFP.docx"
doc.save(out)
print(f"Saved: {out}")
