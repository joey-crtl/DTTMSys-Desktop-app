// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getBookings, updateBookingStatus } = require('./mongodb'); // your MongoDB functions

const app = express();
app.use(cors());
app.use(express.json());

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await getBookings();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking status
app.post('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await updateBookingStatus(id, status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
