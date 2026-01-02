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
        
        // Check for PEM header/footer
        const hasHeader = key.includes('-----BEGIN');
        const hasFooter = key.includes('-----END');
        
        // If missing headers, try to reconstruct (common when copy-pasting just the base64 content)
        if (!hasHeader || !hasFooter) {
            // Remove any existing partial headers/whitespace and get just the base64 content
            let base64Content = key
                .replace(/-----BEGIN[^-]*-----/g, '')
                .replace(/-----END[^-]*-----/g, '')
                .replace(/[\r\n\s]/g, '');
            
            // Only attempt reconstruction if we have substantial base64 content
            if (base64Content.length > 100) {
                console.log('Private key missing PEM headers, attempting to reconstruct...');
                // Format as proper PEM with 64-char lines
                const lines = base64Content.match(/.{1,64}/g) || [];
                key = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----\n';
            }
        }
        
        return key;
    }

    const privateKey = normalizePrivateKey(privateKeyRaw);
    
    // Debug: log key structure (not the actual key!)
    console.log('Private key check', {
        length: privateKey.length,
        hasBeginHeader: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
        hasEndFooter: privateKey.includes('-----END PRIVATE KEY-----'),
        newlineCount: (privateKey.match(/\n/g) || []).length,
        preview: privateKey.slice(0, 40) + '...',
    });

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
