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

    function normalizePrivateKey(raw) {
        let key = (raw || '').trim();
        // Strip surrounding quotes if present
        if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith('\'') && key.endsWith('\''))) {
            key = key.slice(1, -1);
        }
        // Convert escaped newlines/carriage returns to real ones
        key = key.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
        return key;
    }

    const privateKey = normalizePrivateKey(privateKeyRaw);

    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        } catch (e) {
            console.error('Firebase initializeApp error', { message: e?.message });
            // Add a hint if key likely has bad formatting
            const hasHeader = privateKey.includes('BEGIN PRIVATE KEY');
            const hasNewlines = privateKey.includes('\n');
            const hint = !hasHeader ? 'Missing key header/footer.' : (!hasNewlines ? 'No newlines found; ensure \\n are present.' : '');
            throw new Error(`Failed to initialize Firebase Admin: ${e?.message}. ${hint}`.trim());
        }
    }

    db = admin.firestore();
    return db;
}

module.exports = { initializeFirebase, admin };
