const nodemailer = require("nodemailer");

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!process.env.EMAIL_HOST) {
    // Email not configured – silently skip
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return _transporter;
}

/**
 * Send an absence notification email.
 * Fails silently if email is not configured.
 */
async function sendAbsenceEmail({ to, studentName, subjectName, date }) {
  const transporter = getTransporter();
  if (!transporter || !to) return;

  const from = process.env.EMAIL_FROM || `"AttendFP" <${process.env.EMAIL_USER}>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Absence Notice – ${subjectName} on ${date}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#f1f5f9;
                    padding:32px;max-width:520px;margin:0 auto;border-radius:16px;">
          <h2 style="color:#ef4444;margin-top:0;">Absence Recorded</h2>
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>This is an automated notice that you have been marked <strong style="color:#ef4444;">absent</strong>
             for:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr>
              <td style="color:#94a3b8;padding:6px 0;">Subject</td>
              <td style="font-weight:600;">${subjectName}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;padding:6px 0;">Date</td>
              <td style="font-weight:600;">${date}</td>
            </tr>
          </table>
          <p style="color:#94a3b8;font-size:13px;">
            If you believe this is an error, please contact your instructor.
          </p>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
          <p style="color:#475569;font-size:12px;margin:0;">
            AttendFP – Fingerprint Attendance System
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Email] Failed to send absence notice:", err.message);
  }
}

// Expose a lazily-evaluated transporter for other modules (e.g. sendPasswordReset)
const transporter = {
  sendMail: async (opts) => {
    const t = getTransporter();
    if (!t) throw new Error("Email not configured.");
    return t.sendMail(opts);
  },
};

module.exports = { sendAbsenceEmail, transporter };
