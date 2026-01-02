// Admin gets all registered comedians
const { initializeFirebase } = require('./firebase-init');
const { checkAdmin } = require('./admin-check');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const adminCheck = checkAdmin(event, context);

        if (!adminCheck.isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Admin access required' }),
            };
        }

        const db = initializeFirebase();
        console.log('getComedians: querying comedians collection');
        // Removed orderBy to avoid index requirement - sort in memory instead
        const snapshot = await db.collection('comedians').get();
        console.log('getComedians: found documents', { count: snapshot.size });

        const comedians = [];
        snapshot.forEach(doc => {
            comedians.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        // Sort by name in memory (handles missing name field gracefully)
        comedians.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        console.log('getComedians: returning comedians', { count: comedians.length });

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
