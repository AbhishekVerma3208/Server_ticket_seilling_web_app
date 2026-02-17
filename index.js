// server.js
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

// Facility Schema
const facilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['ride', 'water', 'family', 'show', 'dining', 'other'],
    default: 'ride'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Facility = mongoose.model('Facility', facilitySchema);

// Ticket Schema
const ticketSchema = new mongoose.Schema({
  facilityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility',
    required: true
  },
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
    default: ''
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

// Purchase Schema
const purchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  facilityName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

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

// Create some sample facilities if none exist
const createSampleFacilities = async () => {
  try {
    const facilityCount = await Facility.countDocuments();
    if (facilityCount === 0) {
      const sampleFacilities = [
        {
          name: 'Roller Coaster',
          description: 'Experience the thrill of our high-speed roller coaster with loops and drops',
          category: 'ride',
          image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        },
        {
          name: 'Water Slide',
          description: 'Cool off with our exciting water slide adventure',
          category: 'water',
          image: 'https://thumbs.dreamstime.com/z/water-slide-1112181.jpg'
        }
      ];
      
      await Facility.insertMany(sampleFacilities);
      console.log('✅ Sample facilities created');
    }
  } catch (error) {
    console.error('Error creating sample facilities:', error);
  }
};

// Create some sample tickets if none exist
const createSampleTickets = async () => {
  try {
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      const facilities = await Facility.find();
      
      if (facilities.length > 0) {
        const sampleTickets = [];
        
        facilities.forEach(facility => {
          sampleTickets.push({
            facilityId: facility._id,
            type: 'Adult',
            price: 100,
            description: 'For visitors aged 13-64',
            available: 150,
            sold: 35
          });
          
          sampleTickets.push({
            facilityId: facility._id,
            type: 'Child',
            price: 70,
            description: 'For visitors aged 3-12',
            available: 200,
            sold: 28
          });
        });
        
        await Ticket.insertMany(sampleTickets);
        console.log('✅ Sample tickets created');
      }
    }
  } catch (error) {
    console.error('Error creating sample tickets:', error);
  }
};

// Facility Routes
app.get('/api/facilities', async (req, res) => {
  try {
    const facilities = await Facility.find().sort({ createdAt: -1 });
    res.json(facilities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/facilities', async (req, res) => {
  try {
    const facility = new Facility({
      name: req.body.name,
      description: req.body.description,
      image: req.body.image,
      category: req.body.category
    });

    const newFacility = await facility.save();
    res.status(201).json(newFacility);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/facilities/:id', async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);
    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    await Ticket.deleteMany({ facilityId: req.params.id });
    await Facility.findByIdAndDelete(req.params.id);
    res.json({ message: 'Facility deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ticket Routes with populated facility data
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('facilityId', 'name description image category')
      .sort({ createdAt: -1 });
    
    // Format the response to include facility name
    const formattedTickets = tickets.map(ticket => ({
      _id: ticket._id,
      facilityId: ticket.facilityId._id,
      facilityName: ticket.facilityId.name,
      type: ticket.type,
      price: ticket.price,
      description: ticket.description,
      available: ticket.available,
      sold: ticket.sold,
      createdAt: ticket.createdAt
    }));
    
    res.json(formattedTickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const facility = await Facility.findById(req.body.facilityId);
    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    const ticket = new Ticket({
      facilityId: req.body.facilityId,
      type: req.body.type,
      price: req.body.price,
      description: req.body.description,
      available: req.body.available,
      sold: req.body.sold || 0
    });

    const newTicket = await ticket.save();
    
    // Populate facility data before sending response
    const populatedTicket = await Ticket.findById(newTicket._id)
      .populate('facilityId', 'name description image category');
    
    res.status(201).json({
      _id: populatedTicket._id,
      facilityId: populatedTicket.facilityId._id,
      facilityName: populatedTicket.facilityId.name,
      type: populatedTicket.type,
      price: populatedTicket.price,
      description: populatedTicket.description,
      available: populatedTicket.available,
      sold: populatedTicket.sold,
      createdAt: populatedTicket.createdAt
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (req.body.facilityId != null) ticket.facilityId = req.body.facilityId;
    if (req.body.type != null) ticket.type = req.body.type;
    if (req.body.price != null) ticket.price = req.body.price;
    if (req.body.description != null) ticket.description = req.body.description;
    if (req.body.available != null) ticket.available = req.body.available;
    if (req.body.sold != null) ticket.sold = req.body.sold;
    
    const updatedTicket = await ticket.save();
    
    // Populate facility data before sending response
    const populatedTicket = await Ticket.findById(updatedTicket._id)
      .populate('facilityId', 'name description image category');
    
    res.json({
      _id: populatedTicket._id,
      facilityId: populatedTicket.facilityId._id,
      facilityName: populatedTicket.facilityId.name,
      type: populatedTicket.type,
      price: populatedTicket.price,
      description: populatedTicket.description,
      available: populatedTicket.available,
      sold: populatedTicket.sold,
      createdAt: populatedTicket.createdAt
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Purchase Routes
app.get('/api/purchases/:userId', async (req, res) => {
  try {
    const purchases = await Purchase.find({ userId: req.params.userId })
      .sort({ date: -1 });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const purchase = new Purchase({
      userId: req.body.userId,
      ticketId: req.body.ticketId,
      facilityName: req.body.facilityName,
      type: req.body.type,
      price: req.body.price,
      quantity: req.body.quantity,
      total: req.body.total
    });

    const newPurchase = await purchase.save();
    
    // Update ticket sold count
    await Ticket.findByIdAndUpdate(req.body.ticketId, {
      $inc: { sold: req.body.quantity, available: -req.body.quantity }
    });

    res.status(201).json(newPurchase);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// User Routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Auth Routes
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
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
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
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
  await createSampleFacilities();
  await createSampleTickets();
};

// Start server
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  await initializeData();
});
