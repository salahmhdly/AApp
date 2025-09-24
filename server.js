const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Example: Get all users
app.get('/users', (req, res) => {
  fs.readFile('users.json', 'utf8', (err, data) => {
    if (err) return res.status(500).json({error: 'Cannot read users'});
    res.json(JSON.parse(data));
  });
});

// Example: Get all posts
app.get('/posts', (req, res) => {
  fs.readFile('posts.json', 'utf8', (err, data) => {
    if (err) return res.status(500).json({error: 'Cannot read posts'});
    res.json(JSON.parse(data));
  });
});

// Example: Get all ads
app.get('/ads', (req, res) => {
  fs.readFile('ads.json', 'utf8', (err, data) => {
    if (err) return res.status(500).json({error: 'Cannot read ads'});
    res.json(JSON.parse(data));
  });
});

// Example: Get all notifications
app.get('/notifications', (req, res) => {
  fs.readFile('notifications.json', 'utf8', (err, data) => {
    if (err) return res.status(500).json({error: 'Cannot read notifications'});
    res.json(JSON.parse(data));
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`وظائفي server running on port ${PORT}`);
});
