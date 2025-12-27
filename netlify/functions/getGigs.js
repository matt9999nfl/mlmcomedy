// Fetch all gigs - available to all authenticated users
const { initializeFirebase } = require('./firebase-init');

exports.handler = async (event, context) => {
    // CORS headers
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
        const db = initializeFirebase();
        
        // Parse query parameters
        const params = event.queryStringParameters || {};
        const showPast = params.showPast === 'true';
        const status = params.status; // 'open', 'full', 'completed'

        let query = db.collection('gigs');
        
        // Filter by date
        const now = new Date().toISOString();
        if (!showPast) {
            query = query.where('date', '>=', now.split('T')[0]);
        }

        // Get gigs
        const snapshot = await query.orderBy('date', 'asc').get();
        
        const gigs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Filter by status if specified
            if (status && data.status !== status) return;
            
            gigs.push({
                id: doc.id,
                ...data,
                slotsAvailable: data.slotsTotal - (data.lineup?.length || 0),
            });
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, gigs }),
        };
    } catch (error) {
        console.error('Error fetching gigs:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to fetch gigs' }),
        };
    }
};
