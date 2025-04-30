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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

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

// Root Route
app.get('/', (req, res) => {
  res.send('✅ Backend is deployed and running!');
});

// Create Reminder
app.post('/api/reminders', async (req, res) => {
  try {
    const reminder = new Reminder(req.body);
    await reminder.save();
    res.status(201).json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get All Reminders
app.get('/api/reminders', async (req, res) => {
  try {
    const reminders = await Reminder.find();
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Reminder
app.delete('/api/reminders/:id', async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Cron Job to Send Email Every Minute
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const oneMinuteAgo = new Date(now.getTime() - 60000).toTimeString().slice(0, 5);

  console.log('⏰ Cron running at:', currentTime);

  try {
    const reminders = await Reminder.find({
      time: { $in: [oneMinuteAgo, currentTime] },
    });

    console.log(`📬 Found ${reminders.length} reminders for time ${currentTime}`);

    reminders.forEach(async (reminder) => {
      try {
        await transporter.sendMail({
          from: `"Medicine Reminder" <${process.env.EMAIL_USER}>`,
          to: reminder.email,
          subject: `⏰ Time to take your medicine`,
          text: `It's ${reminder.time}. Please take your medicine: ${reminder.medicine}`,
        });
        console.log(`📧 Email sent to ${reminder.email} for medicine: ${reminder.medicine}`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${reminder.email}:`, err.message);
      }
    });
  } catch (err) {
    console.error('❌ Error in cron job:', err.message);
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
