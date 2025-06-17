const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const app = express();
const port = 3000;
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const linksCollection = db.collection('links');


// Serve the frontend file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Middleware to parse JSON body
app.use(express.json());


// Helper to generate random short code
function generateCode(length = 6) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Endpoint to shorten a URL
app.post('/shorten', async (req, res) => {
  const { url } = req.body;

  const shortCode = Math.random().toString(36).substring(2, 8);

  await db.collection('links').doc(shortCode).set({
    url,
    created: admin.firestore.FieldValue.serverTimestamp(),
    clicks: 0
  });

  res.json({ shortUrl: `http://localhost:3000/${shortCode}` });
});




// Redirect endpoint
app.get('/:code', async (req, res) => {
  const code = req.params.code;
  const doc = await db.collection('links').doc(code).get();

  if (!doc.exists) {
    return res.status(404).send('Link not found');
  }

  const data = doc.data();

  // Optional: increment click count
  await db.collection('links').doc(code).update({
    clicks: (data.clicks || 0) + 1
  });

  res.redirect(data.url);
});


app.listen(port, () => {
  console.log(`Link shortener listening at http://localhost:${port}`);
});
