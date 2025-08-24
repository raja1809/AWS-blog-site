const express = require('express');
const multer = require('multer');
const { getPool } = require('../config/database');
const { uploadToS3 } = require('../config/aws');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create a new post
router.post('/posts', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const { caption } = req.body;
    const pool = getPool();

    if (!req.file) {
      return res.status(400).json({ message: 'Media file is required' });
    }

    // Determine media type
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    
    // Upload to S3
    const fileName = `posts/${Date.now()}-${req.file.originalname}`;
    const uploadResult = await uploadToS3(req.file.buffer, fileName, req.file.mimetype);

    // Save to database
    const [result] = await pool.execute(
      'INSERT INTO posts (user_id, caption, media_url, media_type) VALUES (?, ?, ?, ?)',
      [req.user.userId, caption, uploadResult.Location, mediaType]
    );

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        id: result.insertId,
        caption,
        mediaUrl: uploadResult.Location,
        mediaType
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts
router.get('/posts', async (req, res) => {
  try {
    const pool = getPool();
    
    const [posts] = await pool.execute(`
      SELECT 
        p.id, p.caption, p.media_url, p.media_type, p.created_at,
        u.name as author_name, u.profile_photo as author_photo
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get posts by user
router.get('/posts/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = getPool();
    
    const [posts] = await pool.execute(`
      SELECT 
        p.id, p.caption, p.media_url, p.media_type, p.created_at,
        u.name as author_name, u.profile_photo as author_photo
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);

    res.json(posts);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;