const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const app = express();
const port = 3000;
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json');
require('dotenv').config();

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
  const { url, custom } = req.body;

  if (!isValidUrl(url)) {
    return res.json({ error: 'Invalid URL' });
  }

  if (isBlocked(url)) {
    return res.json({ error: 'This URL is blocked due to policy' });
  }

  // Check with Google Safe Browsing
  try {
    const isUnsafe = await checkGoogleSafeBrowsing(url);
    if (isUnsafe) {
      return res.json({ error: 'URL flagged as unsafe by Google Safe Browsing' });
    }
  } catch (err) {
    console.error('GSB API error:', err);
    return res.json({ error: 'Error checking URL safety' });
  }

  // Continue with link shortening...
  let shortCode = custom || Math.random().toString(36).substring(2, 8);
  // Validate custom, check availability...

  await db.collection('links').doc(shortCode).set({
    url,
    created: admin.firestore.FieldValue.serverTimestamp(),
    clicks: 0,
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









import fetch from 'node-fetch';  // if using ES modules
// or for CommonJS:
const fetch = require('node-fetch');

const API_KEY = process.env.GSB_API_KEY;  // Store your API key safely in .env!

async function checkGoogleSafeBrowsing(url) {
  const body = {
    client: {
      clientId: "your-company-name",
      clientVersion: "1.0"
    },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [
        { url }
      ]
    }
  };

  const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  return data && data.matches && data.matches.length > 0;
}
