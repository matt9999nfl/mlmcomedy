// Admin gets all registered comedians
const { initializeFirebase } = require('./firebase-init');

function isAdmin(user) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    return adminEmails.includes(user?.email?.toLowerCase());
}

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

    try {
        const { user } = context.clientContext || {};

        if (!user || !isAdmin(user)) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Admin access required' }),
            };
        }

        const db = initializeFirebase();
        const snapshot = await db.collection('comedians').orderBy('name', 'asc').get();

        const comedians = [];
        snapshot.forEach(doc => {
            comedians.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                comedians,
                total: comedians.length,
            }),
        };
    } catch (error) {
        console.error('Error fetching comedians:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to fetch comedians' }),
        };
    }
};
