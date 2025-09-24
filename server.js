const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Helper Functions ---
const dataDir = path.join(__dirname);

function getFilePath(collection) {
  const allowed = ['users', 'ads', 'posts', 'notifications', 'reports'];
  if (!allowed.includes(collection)) throw new Error('Invalid collection');
  return path.join(dataDir, `${collection}.json`);
}

async function readCollection(collection) {
  const file = getFilePath(collection);
  try {
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeCollection(collection, data) {
  const file = getFilePath(collection);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

// --- Firestore-like Endpoints ---

// GET /{collection}?field=value&...
app.get('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    let docs = await readCollection(collection);

    // Filtering
    Object.entries(req.query).forEach(([key, val]) => {
      docs = docs.filter(doc => doc[key] == val);
    });

    res.json(docs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /{collection}/:id
app.get('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const docs = await readCollection(collection);
    const doc = docs.find(d => d.id == id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /{collection}
app.post('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const docs = await readCollection(collection);

    const newDoc = {
      ...req.body,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    docs.push(newDoc);
    await writeCollection(collection, docs);
    res.status(201).json(newDoc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /{collection}/:id
app.patch('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let docs = await readCollection(collection);
    const idx = docs.findIndex(d => d.id == id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    // Special logic for likes and notifications (posts, ads)
    if ((collection === 'posts' || collection === 'ads') && req.body.likers) {
      // Update likers and likesCount
      docs[idx].likers = req.body.likers;
      docs[idx].likesCount = req.body.likers.length;

      // Add notification
      const notifications = await readCollection('notifications');
      notifications.push({
        id: generateId(),
        type: 'like',
        collection,
        targetId: id,
        likerId: req.body.likerId || null,
        createdAt: new Date().toISOString(),
        message: `تم الإعجاب بـ ${collection === 'posts' ? 'منشور' : 'إعلان'}`,
      });
      await writeCollection('notifications', notifications);
    } else {
      // Regular update
      docs[idx] = { ...docs[idx], ...req.body };
    }

    await writeCollection(collection, docs);
    res.json(docs[idx]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /{collection}/:id
app.delete('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let docs = await readCollection(collection);
    const idx = docs.findIndex(d => d.id == id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const removed = docs.splice(idx, 1)[0];
    await writeCollection(collection, docs);
    res.json(removed);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- User Logic ---

// Toggle Follow
app.post('/users/toggle-follow', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    const users = await readCollection('users');
    const followerIdx = users.findIndex(u => u.id == followerId);
    const followingIdx = users.findIndex(u => u.id == followingId);

    if (followerIdx === -1 || followingIdx === -1)
      return res.status(404).json({ error: 'User not found' });

    const follower = users[followerIdx];
    const following = users[followingIdx];

    // Toggle follow
    follower.following = follower.following || [];
    following.followers = following.followers || [];
    if (!follower.following.includes(followingId)) {
      follower.following.push(followingId);
      following.followers.push(followerId);
    } else {
      follower.following = follower.following.filter(id => id !== followingId);
      following.followers = following.followers.filter(id => id !== followerId);
    }

    users[followerIdx] = follower;
    users[followingIdx] = following;
    await writeCollection('users', users);
    res.json({ follower, following });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { username, password, ...rest } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    const users = await readCollection('users');
   
