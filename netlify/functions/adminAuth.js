// Separate admin authentication - uses env vars only, no Netlify Identity dependency
const crypto = require('crypto');

// Simple password hashing
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, storedHash, salt) {
    const hash = hashPassword(password, salt);
    return hash === storedHash;
}

// Generate a simple JWT-like token (signed with a secret)
function generateToken(email, secret) {
    const payload = {
        email: email.toLowerCase(),
        exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        iat: Date.now(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    return `${payloadB64}.${signature}`;
}

function verifyToken(token, secret) {
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

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { action, email, password, token } = JSON.parse(event.body || '{}');
        
        // Get admin credentials from env
        const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
        const adminSalt = process.env.ADMIN_SALT || 'mlmcomedy-default-salt';
        const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_SALT || 'mlmcomedy-jwt-secret';

        if (!adminEmail) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Admin not configured. Set ADMIN_EMAIL in environment variables.' 
                }),
            };
        }

        // LOGIN action
        if (action === 'login') {
            if (!email || !password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Email and password required' }),
                };
            }

            const inputEmail = email.trim().toLowerCase();
            
            // Check email matches
            if (inputEmail !== adminEmail) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Invalid credentials' }),
                };
            }

            // If no password hash set, use a default (for initial setup)
            // IMPORTANT: Set ADMIN_PASSWORD_HASH in production!
            if (!adminPasswordHash) {
                // First-time setup: accept any password and tell them to set up properly
                // For now, use a simple default password check
                if (password !== process.env.ADMIN_PASSWORD) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            error: 'Invalid credentials. Set ADMIN_PASSWORD in environment variables.' 
                        }),
                    };
                }
            } else {
                // Verify against stored hash
                if (!verifyPassword(password, adminPasswordHash, adminSalt)) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Invalid credentials' }),
                    };
                }
            }

            // Generate token
            const authToken = generateToken(inputEmail, jwtSecret);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    token: authToken,
                    email: inputEmail,
                    expiresIn: 86400, // 24 hours in seconds
                }),
            };
        }

        // VERIFY action - check if token is valid
        if (action === 'verify') {
            if (!token) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Token required' }),
                };
            }

            const payload = verifyToken(token, jwtSecret);
            if (!payload) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Invalid or expired token' }),
                };
            }

            // Also verify email is still admin
            if (payload.email !== adminEmail) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Not authorized' }),
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    email: payload.email,
                    isAdmin: true,
                }),
            };
        }

        // HASH action - utility to generate password hash (for setup)
        if (action === 'hash') {
            if (!password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Password required' }),
                };
            }
            
            const hash = hashPassword(password, adminSalt);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Set this as ADMIN_PASSWORD_HASH in your environment variables',
                    hash: hash,
                    salt: adminSalt,
                }),
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid action. Use: login, verify, or hash' }),
        };

    } catch (error) {
        console.error('Admin auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Server error' }),
        };
    }
};
