const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const crypto = require('crypto');
const app = express();
const port = 3000;
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();
//////////////////////////////////////////////

// const serviceAccount = require('./firebase-key.json');

const serviceAccount = {
  type: process.env.firebase_type,
  project_id: process.env.firebase_project_id,
  private_key_id: process.env.firebase_private_key_id,
  private_key: process.env.firebase_private_key.replace(/\\n/g, '\n'),
  client_email: process.env.firebase_client_email,
  client_id: process.env.firebase_client_id,
  auth_uri: process.env.firebase_auth_uri,
  token_uri: process.env.firebase_token_uri,
  auth_provider_x509_cert_url: process.env.firebase_auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.firebase_client_x509_cert_url,
  universe_domain: process.env.firebase_universe_domain
};

/////////////////////////////////////////////


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const linksCollection = db.collection('links');


// Serve the frontend file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});



app.use(express.json());


function generateCode(length = 6) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}
function isBlocked(url) {
  const blockedKeywords = [];
  return blockedKeywords.some(keyword => url.toLowerCase().includes(keyword));
}


app.post('/shorten', async (req, res) => {
  const { url, custom } = req.body;

  if (!isValidUrl(url)) {
    return res.json({ error: 'Invalid URL' });
  }

  if (isBlocked(url)) {
    return res.json({ error: 'This URL is blocked due to policy' });
  }


  try {
    const isUnsafe = await checkGoogleSafeBrowsing(url);
    if (isUnsafe) {
      return res.json({ error: 'URL flagged as unsafe by Google Safe Browsing' });
    }
  } catch (err) {
    console.error('GSB API error:', err);
    return res.json({ error: 'Error checking URL safety' });
  }


  let shortCode = custom || Math.random().toString(36).substring(2, 8);


  await db.collection('links').doc(shortCode).set({
    url,
    created: admin.firestore.FieldValue.serverTimestamp(),
    clicks: 0,
  });

  res.json({ shortUrl: `http://localhost:3000/${shortCode}` });
});



app.get('/:code', async (req, res) => {
  const code = req.params.code;
  const doc = await db.collection('links').doc(code).get();

  if (!doc.exists) {
    return res.status(404).send('Link not found');
  }

  const data = doc.data();


  await db.collection('links').doc(code).update({
    clicks: (data.clicks || 0) + 1
  });

  res.redirect(data.url);
});


app.listen(port, () => {
  console.log(`Link shortener listening at http://localhost:${port}`);
});










// or for CommonJS:
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
