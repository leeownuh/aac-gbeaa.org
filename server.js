const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');

const router = express.Router();
const PORT = process.env.PORT || 3000;
const dataPath = path.join(__dirname, "data", "article.json");
let categories = [];

// Middleware
router.use(cors());
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));
router.use(express.static('.'));
// Serve static gallery images properly
router.use('/assets', express.static(path.join(__dirname, 'assets')));
router.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
router.use(session({
  secret: 'aac-gbeaaa-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
  secure: true,
  sameSite: "none",
  maxAge: 24 * 60 * 60 * 1000
}
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
};

// Helper function to read JSON files
const readJSON = (filepath) => {
  try {
    if (!fs.existsSync(filepath)) {
      return [];
    }
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error);
    return [];
  }
};

// Helper function to write JSON files
const writeJSON = (filepath, data) => {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filepath}:`, error);
    return false;
  }
};
// ==================== AUTH ROUTES ====================

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminData = readJSON('./data/admin.json');

    // Check username
    if (username !== adminData.username) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, adminData.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Create session
    req.session.admin = { username: adminData.username };

    // Optional functions
    loadGallery();
    loadCategories();

    return res.json({ success: true, message: 'Login successful' });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Admin logout
router.post('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check admin session
router.get('/admin/check', (req, res) => {
  if (req.session && req.session.admin) {
    res.json({ authenticated: true, username: req.session.admin.username });
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== ARTICLES ROUTES ====================

// Get all articles
router.get('/articles', (req, res) => {
  const articles = readJSON(dataPath);
  res.json(articles);
});

// Get single article
router.get('/articles/:id', (req, res) => {
  const articles = readJSON(dataPath);
  const article = articles.find(a => a.id === req.params.id);
  if (article) {
    res.json(article);
  } else {
    res.status(404).json({ error: 'Article not found' });
  }
});

function generateExcerpt(text, length = 150) {
  if (!text) return "";
  return text.substring(0, length) + (text.length > length ? "..." : "");
}
// Create article// Create article (Only required fields)
router.post('/articles', authenticateAdmin, (req, res) => {

  try {

    const { title, content, author, date, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: "Title and Content required"
      });
    }

    let articles = readJSON(dataPath);

    const newArticle = {
      id: Date.now().toString(),
      title,
      content,
      author: author || "Admin",
      excerpt: generateExcerpt(content),
      date: date || new Date().toISOString().split('T')[0],
      category: category || "General"
    };

    articles.unshift(newArticle);

    /* ⭐ FIXED */
    writeJSON(dataPath, articles);

    res.status(201).json({
      success: true,
      article: newArticle
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }

});

// Update article
router.put('/articles/:id', authenticateAdmin, (req, res) => {
  try {
    let articles = readJSON(dataPath);
    const index = articles.findIndex(a => a.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Article not found' });
    }

    articles[index] = {
      ...articles[index],
      title: req.body.title || articles[index].title,
      content: req.body.content || articles[index].content,
      author: req.body.author || articles[index].author,
      date: req.body.date || articles[index].date,
      category: req.body.category || articles[index].category
    };

    if (writeJSON(dataPath, articles)) {
      res.json({ success: true, message: 'Article updated', article: articles[index] });
    } else {
      res.status(500).json({ error: 'Failed to update article' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Delete article
router.delete('/articles/:id', authenticateAdmin, (req, res) => {
  try {
    let articles = readJSON(dataPath);
    const initialLength = articles.length;
    articles = articles.filter(article => article.id !== req.params.id);

    if (articles.length === initialLength) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (writeJSON(dataPath, articles)) {
      res.json({ success: true, message: 'Article deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete article' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ==================== EVENTS ROUTES ====================

// Get all events
router.get('/events', (req, res) => {
  const events = readJSON('./data/events.json');
  res.json(events);
});

// Get single event
router.get('/events/:id', (req, res) => {
  const events = readJSON('./data/events.json');
  const event = events.find(e => e.id === req.params.id);
  if (event) {
    res.json(event);
  } else {
    res.status(404).json({ error: 'Event not found' });
  }
});

// Create event 
const { v4: uuidv4 } = require('uuid');

router.post('/events', authenticateAdmin, upload.single('image'), (req, res) => {
  try {
    const {
      title,
      description,
      date,
      end_date,
      time,
      location,
      category,
      details_url
    } = req.body;

    if (!title || !description || !date || !location) {
      return res.status(400).json({
        error: 'Title, description, date and location are required'
      });
    }

    let events = readJSON('./data/events.json');

    const newEvent = {
      id: uuidv4(),
      title,
      description,
      date,
      end_date: end_date || null,
      time: time || null,
      location,
      category: category || null,
      details_url: details_url || null,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString()
    };

    events.push(newEvent);

    if (writeJSON('./data/events.json', events)) {
      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        event: newEvent
      });
    } else {
      res.status(500).json({ error: 'Failed to save event' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/events/:id', authenticateAdmin, upload.single('image'), (req, res) => {
  try {
    let events = readJSON('./data/events.json');
    const index = events.findIndex(e => e.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }

    events[index] = {
      ...events[index],
      title: req.body.title || events[index].title,
      description: req.body.description || events[index].description,
      date: req.body.date || events[index].date,
      end_date: req.body.end_date || events[index].end_date,
      time: req.body.time || events[index].time,
      location: req.body.location || events[index].location, image: req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image || events[index].image,
      category: req.body.category || events[index].category,
      details_url: req.body.details_url || events[index].details_url
    };

    if (writeJSON('./data/events.json', events)) {
      res.json({ success: true, message: 'Event updated', event: events[index] });
    } else {
      res.status(500).json({ error: 'Failed to update event' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/events/:id', authenticateAdmin, (req, res) => {
  try {
    let events = readJSON('./data/events.json');
    const initialLength = events.length;
    events = events.filter(event => event.id !== req.params.id);

    if (events.length === initialLength) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (writeJSON('./data/events.json', events)) {
      res.json({ success: true, message: 'Event deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete event' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ==================== GALLERY ROUTES ====================
// Get categories
router.get('/gallery/categories', (req, res) => {
  const gallery = readJSON('./data/gallery.json');

  res.json(gallery.categories || []);
});
// Get all gallery images
router.get('/gallery', (req, res) => {

  try {

    const gallery = readJSON('./data/gallery.json');

    res.json({
      categories: gallery.categories || [],
      images: gallery.images || []
    });

  } catch (err) {
    res.status(500).json({ error: "Gallery load failed" });
  }

});
// Add category
router.post('/gallery/categories', authenticateAdmin, (req, res) => {

  try {

    const { name, slug, folder, filterClass } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: "Name and slug required"
      });
    }

    const gallery = readJSON('./data/gallery.json');

    // Prevent duplicates
    const exists = gallery.categories.some(
      c => c.slug === slug
    );

    if (exists) {
      return res.status(400).json({
        error: "Category already exists"
      });
    }

    // ✅ Create category FIRST
    const newCategory = {
      name,
      slug,
      folder: folder || slug,
      filterClass: filterClass || slug
    };

    // ✅ Create folder AFTER category is created
    const folderPath = path.join(
      __dirname,
      'assets/images/gallery',
      newCategory.folder
    );

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Save category
    gallery.categories.push(newCategory);
    writeJSON('./data/gallery.json', gallery);

    res.json({
      success: true,
      category: newCategory
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to add category"
    });
  }

});

router.post('/gallery/categories', authenticateAdmin, (req, res) => {

  try {

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name required" });
    }

    const gallery = readJSON('./data/gallery.json');

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const exists = gallery.categories.some(
      c => c.slug === slug
    );

    if (exists) {
      return res.status(400).json({ error: "Category exists" });
    }

    const newCategory = {
      name,
      slug,
      folder: slug,
      filterClass: slug
    };

    // Create folder automatically
    const folderPath = path.join(
      __dirname,
      'assets/images/gallery',
      slug
    );

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    gallery.categories.push(newCategory);

    writeJSON('./data/gallery.json', gallery);

    res.json({
      success: true,
      category: newCategory
    });

  } catch (err) {
    res.status(500).json({ error: "Category creation failed" });
  }

});
// Count gallery images
router.get('/gallery/count', (req, res) => {
  try {
    const gallery = readJSON('./data/gallery.json');

    res.json({
      count: (gallery.images || []).length
    });

  } catch (err) {
    res.status(500).json({ error: "Count failed" });
  }
});
// Delete gallery image
router.delete('/gallery/:file', authenticateAdmin, (req, res) => {

  try {

    const galleryData = readJSON('./data/gallery.json');

    galleryData.images = galleryData.images.filter(
      img => img.file !== req.params.file
    );

    writeJSON('./data/gallery.json', galleryData);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }

});

// ==================== ERROR HANDLING ====================

router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = router;