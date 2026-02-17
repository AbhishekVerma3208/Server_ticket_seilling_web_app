// index.js (or server.js)
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.mongo_uri

mongoose.connect(mongoURI)
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// Ticket Schema
const ticketSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  available: {
    type: Number,
    required: true,
    default: 0
  },
  sold: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

// Create admin user if not exists
const createAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@parmar.com' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminUser = new User({
        name: 'Admin User',
        email: 'admin@parmar.com',
        password: hashedPassword,
        role: 'admin'
      });
      await adminUser.save();
      console.log('✅ Admin user created');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Create some sample tickets if none exist
const createSampleTickets = async () => {
  try {
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      const sampleTickets = [
        {
          type: 'Adult',
          price: 100,
          description: 'For visitors aged 13-64',
          available: 150,
          sold: 350
        },
        {
          type: 'Child',
          price: 70,
          description: 'For visitors aged 3-12',
          available: 200,
          sold: 280
        },
        {
          type: 'Senior',
          price: 80,
          description: 'For visitors aged 65+',
          available: 80,
          sold: 120
        },
        {
          type: 'VIP',
          price: 200,
          description: 'Skip-the-line access + meal voucher',
          available: 30,
          sold: 70
        }
      ];
      
      await Ticket.insertMany(sampleTickets);
      console.log('✅ Sample tickets created');
    }
  } catch (error) {
    console.error('Error creating sample tickets:', error);
  }
};

// Ticket Routes
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = new Ticket({
      type: req.body.type,
      price: req.body.price,
      description: req.body.description,
      available: req.body.available,
      sold: req.body.sold || 0
    });

    const newTicket = await ticket.save();
    res.status(201).json(newTicket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (req.body.type != null) ticket.type = req.body.type;
    if (req.body.price != null) ticket.price = req.body.price;
    if (req.body.description != null) ticket.description = req.body.description;
    if (req.body.available != null) ticket.available = req.body.available;
    if (req.body.sold != null) ticket.sold = req.body.sold;
    
    const updatedTicket = await ticket.save();
    res.json(updatedTicket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Auth Routes
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const userRole = email === 'admin@parmar.com' ? 'admin' : 'user';
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: userRole
    });
    
    await user.save();
    
    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize data
const initializeData = async () => {
  await createAdminUser();
  await createSampleTickets();
};

// Start server
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  await initializeData();
});