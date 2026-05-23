require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const { initFirebase }    = require("./config/firebase");
const { errorHandler }    = require("./middleware/errorHandler");

const authRoutes       = require("./routes/auth");
const usersRoutes      = require("./routes/users");
const studentsRoutes   = require("./routes/students");
const subjectsRoutes   = require("./routes/subjects");
const attendanceRoutes = require("./routes/attendance");
const sessionsRoutes   = require("./routes/sessions");
const marksRoutes      = require("./routes/marks");

initFirebase();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/auth",       authRoutes);
app.use("/api/users",      usersRoutes);
app.use("/api/students",   studentsRoutes);
app.use("/api/subjects",   subjectsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/sessions",   sessionsRoutes);
app.use("/api/marks",      marksRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok", ts: Date.now() }));

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`✓ Fingerprint Attendance API on http://localhost:${PORT}`);
});
