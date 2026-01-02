// Admin gets all booking requests
const { initializeFirebase } = require('./firebase-init');

function isAdmin(user) {
    const raw = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '');
    const adminEmails = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
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
        const params = event.queryStringParameters || {};
        const status = params.status; // 'pending', 'approved', 'rejected'
        const gigId = params.gigId;

        let query = db.collection('bookings');

        if (status) {
            query = query.where('status', '==', status);
        }

        if (gigId) {
            query = query.where('gigId', '==', gigId);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();

        const bookings = [];
        const gigIds = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
            });
            gigIds.add(data.gigId);
        });

        // Fetch gig details
        const gigsMap = {};
        if (gigIds.size > 0) {
            const gigPromises = Array.from(gigIds).map(async gId => {
                const gigDoc = await db.collection('gigs').doc(gId).get();
                if (gigDoc.exists) {
                    gigsMap[gId] = { id: gigDoc.id, ...gigDoc.data() };
                }
            });
            await Promise.all(gigPromises);
        }

        // Combine bookings with gig info
        const enrichedBookings = bookings.map(booking => ({
            ...booking,
            gig: gigsMap[booking.gigId] || null,
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                bookings: enrichedBookings,
                total: enrichedBookings.length,
            }),
        };
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to fetch bookings' }),
        };
    }
};
