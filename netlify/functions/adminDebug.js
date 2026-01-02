// Debug endpoint to diagnose admin authentication issues
// Returns what the server actually sees - user info and admin config

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Get raw Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization || null;

    // Get client context (populated by Netlify when valid JWT is present)
    const clientContext = context.clientContext || null;
    const user = clientContext?.user || null;

    // Get admin emails from environment
    const adminEmailsRaw = process.env.ADMIN_EMAILS || null;
    const adminEmailRaw = process.env.ADMIN_EMAIL || null;
    const combinedRaw = adminEmailsRaw || adminEmailRaw || '';
    const adminEmails = combinedRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    // Check if user would be considered admin
    const userEmail = user?.email?.toLowerCase() || null;
    const isAdmin = userEmail ? adminEmails.includes(userEmail) : false;

    // Return diagnostic info
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            debug: true,
            timestamp: new Date().toISOString(),
            auth: {
                hasAuthHeader: !!authHeader,
                authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : null,
            },
            clientContext: {
                exists: !!clientContext,
                hasUser: !!user,
                hasIdentity: !!clientContext?.identity,
            },
            user: user ? {
                email: user.email,
                sub: user.sub,
                // Include other useful fields if present
                app_metadata: user.app_metadata || null,
                user_metadata: user.user_metadata || null,
            } : null,
            adminConfig: {
                ADMIN_EMAILS_set: !!adminEmailsRaw,
                ADMIN_EMAIL_set: !!adminEmailRaw,
                parsedAdminEmails: adminEmails,
                adminEmailCount: adminEmails.length,
            },
            result: {
                userEmail,
                isAdmin,
                reason: !authHeader ? 'No Authorization header' :
                        !clientContext ? 'No clientContext (JWT not validated)' :
                        !user ? 'No user in clientContext' :
                        !userEmail ? 'No email in user object' :
                        !adminEmails.length ? 'No admin emails configured' :
                        isAdmin ? 'User is admin' : 'User email not in admin list',
            },
        }, null, 2),
    };
};
