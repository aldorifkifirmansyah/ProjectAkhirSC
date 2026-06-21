require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/database"); // Memanggil pool MariaDB

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// ── POST: Simpan Notifikasi Sesuai Kolom Database Asli ────────────────────────
app.post("/api/notifications", async (req, res) => {
  try {
    const payload = req.body;

    // Pemetaan data dari Laravel payload ke kolom asli MariaDB kamu
    const user_id = payload.user_id || null;
    const booking_id = payload.booking_id || payload.vehicle_id || null; // Ambil ID angka
    const type = payload.type || "info";
    const recipient = payload.recipient || "admin"; // Isian default untuk kolom recipient
    const message = payload.message || "No message";
    const status = payload.status || "unread";

    // Query INSERT disesuaikan dengan struktur gambar skema kamu
    const query = `
      INSERT INTO notification_logs (user_id, booking_id, type, recipient, message, status) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(query, [
      user_id,
      booking_id,
      type,
      recipient,
      message,
      status,
    ]);

    res.status(201).json({
      success: true,
      message: "Notification saved to MariaDB successfully",
    });
  } catch (error) {
    console.error("MariaDB SQL Error on POST:", error);
    res
      .status(500)
      .json({ success: false, message: "Database failure: " + error.message });
  }
});

// ── GET: Ambil Notifikasi untuk Dashboard Admin ──────────────────────────────
app.get("/api/notifications", async (req, res) => {
  try {
    // Menarik semua kolom termasuk id, recipient, dan status
    const [rows] = await pool.execute(
      "SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 15",
    );
    res.json(rows);
  } catch (error) {
    console.error("MariaDB SQL Error on GET:", error);
    res
      .status(500)
      .json({ success: false, message: "Database failure: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `Notification service running on port ${PORT} (Connected via Column-Match)`,
  );
});
