// Shared admin verification module
// Supports both Netlify Identity JWT and custom admin tokens

const crypto = require('crypto');

function verifyAdminToken(token, secret) {
    try {
        const [payloadB64, signature] = token.split('.');
        const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
        if (signature !== expectedSig) return null;
        
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        if (payload.exp < Date.now()) return null;
        
        return payload;
    } catch (e) {
        return null;
    }
}

function getAdminEmails() {
    const raw = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '');
    return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if request is from an admin
 * Supports:
 * 1. Custom admin token (X-Admin-Token header)
 * 2. Netlify Identity JWT (Authorization header, via clientContext)
 * 
 * @param {object} event - Netlify function event
 * @param {object} context - Netlify function context
 * @returns {object} { isAdmin: boolean, email: string|null, method: string }
 */
function checkAdmin(event, context) {
    const adminEmails = getAdminEmails();
    const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_SALT || 'mlmcomedy-jwt-secret';
    
    // Method 1: Check custom admin token
    const adminToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
    if (adminToken) {
        const payload = verifyAdminToken(adminToken, jwtSecret);
        if (payload && payload.email) {
            const email = payload.email.toLowerCase();
            if (adminEmails.includes(email)) {
                return { isAdmin: true, email, method: 'admin-token' };
            }
            return { isAdmin: false, email, method: 'admin-token', reason: 'Email not in admin list' };
        }
        return { isAdmin: false, email: null, method: 'admin-token', reason: 'Invalid or expired token' };
    }
    
    // Method 2: Check Netlify Identity JWT (via clientContext)
    const user = context?.clientContext?.user;
    if (user && user.email) {
        const email = user.email.toLowerCase();
        if (adminEmails.includes(email)) {
            return { isAdmin: true, email, method: 'netlify-identity' };
        }
        return { isAdmin: false, email, method: 'netlify-identity', reason: 'Email not in admin list' };
    }
    
    // No valid auth
    return { isAdmin: false, email: null, method: 'none', reason: 'No authentication provided' };
}

module.exports = { checkAdmin, getAdminEmails, verifyAdminToken };
