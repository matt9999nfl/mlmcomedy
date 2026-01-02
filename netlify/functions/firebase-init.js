// Firebase Admin SDK initialization for Netlify Functions
const admin = require('firebase-admin');

let db = null;

function initializeFirebase() {
    if (db) return db;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
        const missing = [
            !projectId ? 'FIREBASE_PROJECT_ID' : null,
            !clientEmail ? 'FIREBASE_CLIENT_EMAIL' : null,
            !privateKeyRaw ? 'FIREBASE_PRIVATE_KEY' : null,
        ].filter(Boolean).join(', ');
        console.error('Firebase init error: missing env vars', { missing });
        throw new Error(`Firebase credentials missing: ${missing}. Configure environment variables in Netlify.`);
    }

    const privateKey = privateKeyRaw.replace(/\n/g, '\n');

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }

    db = admin.firestore();
    return db;
}

module.exports = { initializeFirebase, admin };
