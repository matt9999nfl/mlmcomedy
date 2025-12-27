// Get comedian's approved gigs and pending requests
const { initializeFirebase } = require('./firebase-init');

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

        if (!user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Unauthorized - please log in' }),
            };
        }

        const db = initializeFirebase();

        // Get all bookings for this comedian
        const bookingsSnapshot = await db.collection('bookings')
            .where('comedianId', '==', user.sub)
            .orderBy('createdAt', 'desc')
            .get();

        const bookings = [];
        const gigIds = new Set();

        bookingsSnapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
            });
            gigIds.add(data.gigId);
        });

        // Fetch gig details for all bookings
        const gigsMap = {};
        if (gigIds.size > 0) {
            const gigPromises = Array.from(gigIds).map(async gigId => {
                const gigDoc = await db.collection('gigs').doc(gigId).get();
                if (gigDoc.exists) {
                    gigsMap[gigId] = { id: gigDoc.id, ...gigDoc.data() };
                }
            });
            await Promise.all(gigPromises);
        }

        // Combine bookings with gig details
        const myGigs = bookings.map(booking => ({
            booking,
            gig: gigsMap[booking.gigId] || null,
        }));

        // Separate into categories
        const approved = myGigs.filter(g => g.booking.status === 'approved');
        const pending = myGigs.filter(g => g.booking.status === 'pending');
        const rejected = myGigs.filter(g => g.booking.status === 'rejected');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                approved,
                pending,
                rejected,
                total: myGigs.length,
            }),
        };
    } catch (error) {
        console.error('Error fetching comedian gigs:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to fetch your gigs' }),
        };
    }
};
