const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

// Load env variables
dotenv.config();

// App setup
const app = express();
app.use(cors());
app.use(express.json());

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB error:', err));

// Reminder Schema & Model
const reminderSchema = new mongoose.Schema({
  medicine: String,
  time: String, // Format: "HH:mm"
  email: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const Reminder = mongoose.model('Reminder', reminderSchema);

// Routes
// POST Reminder
app.post('/api/reminders', async (req, res) => {
    try {
      const reminder = new Reminder(req.body);
      await reminder.save();
      res.status(201).json({ success: true, reminder });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
  
  // GET Reminders
  app.get('/api/reminders', async (req, res) => {
    try {
      const reminders = await Reminder.find();
      res.json(reminders);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
  
  // DELETE Reminder by ID
  app.delete('/api/reminders/:id', async (req, res) => {
    try {
      await Reminder.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Reminder deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail
    pass: process.env.EMAIL_PASS, // App Password
  },
});

// Scheduler: check every minute
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
  
  const reminders = await Reminder.find({ time: currentTime });

  reminders.forEach(async (reminder) => {
    if (reminder.days <= 0) return;

    // Send email
    await transporter.sendMail({
      from: `"Medicine Reminder" <${process.env.EMAIL_USER}>`,
      to: reminder.email,
      subject: `⏰ Time to take your medicine`,
      text: `It's ${reminder.time}. Please take your medicine: ${reminder.medicine}`,
    });

    // Decrement day
    reminder.days -= 1;
    await reminder.save();
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
