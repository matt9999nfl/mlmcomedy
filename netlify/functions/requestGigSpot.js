// Comedian requests a spot on a gig
const { initializeFirebase, admin } = require('./firebase-init');

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
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };
    }

    try {
        // Get user from Netlify Identity context
        const { identity, user } = context.clientContext || {};
        
        if (!user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Unauthorized - please log in' }),
            };
        }

        const { gigId, message } = JSON.parse(event.body);

        if (!gigId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Gig ID is required' }),
            };
        }

        const db = initializeFirebase();

        // Check if gig exists and has available slots
        const gigDoc = await db.collection('gigs').doc(gigId).get();
        
        if (!gigDoc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Gig not found' }),
            };
        }

        const gigData = gigDoc.data();
        const slotsAvailable = gigData.slotsTotal - (gigData.lineup?.length || 0);

        if (slotsAvailable <= 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No slots available for this gig' }),
            };
        }

        // Check if comedian already has a pending or approved booking for this gig
        const existingBooking = await db.collection('bookings')
            .where('gigId', '==', gigId)
            .where('comedianId', '==', user.sub)
            .where('status', 'in', ['pending', 'approved'])
            .get();

        if (!existingBooking.empty) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'You already have a booking request for this gig' }),
            };
        }

        // Create booking request
        const bookingRef = await db.collection('bookings').add({
            gigId,
            comedianId: user.sub,
            comedianEmail: user.email,
            comedianName: user.user_metadata?.full_name || user.email,
            status: 'pending',
            message: message || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Booking request submitted successfully',
                bookingId: bookingRef.id,
            }),
        };
    } catch (error) {
        console.error('Error requesting gig spot:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to submit booking request' }),
        };
    }
};
