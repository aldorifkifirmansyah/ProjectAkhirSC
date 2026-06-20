require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const LOG_FILE = path.join(__dirname, 'notification_logs.txt');

app.use(cors());
app.use(express.json());

app.post('/api/notifications', (req, res) => {
  const { booking_code, user_id, vehicle_id, total_price } = req.body;

  const timestamp = new Date().toISOString();
  const logEntry = [
    '========================================',
    `Timestamp    : ${timestamp}`,
    `Booking Code : ${booking_code}`,
    `User ID      : ${user_id}`,
    `Vehicle ID   : ${vehicle_id}`,
    `Total Price  : ${total_price}`,
    '========================================',
    '',
  ].join('\n');

  fs.appendFile(LOG_FILE, logEntry, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to log notification' });
    }
    res.status(201).json({ success: true, message: 'Notification logged successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`notification-service running on port ${PORT}`);
});
