// Admin approves or rejects a booking request
const { initializeFirebase, admin } = require('./firebase-init');

// Check if user is admin
function isAdmin(user) {
    const raw = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '');
    const adminEmails = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user?.email?.toLowerCase());
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
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };
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

        const { bookingId, action, rejectionReason } = JSON.parse(event.body);

        if (!bookingId || !['approve', 'reject'].includes(action)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Booking ID and valid action (approve/reject) required' }),
            };
        }

        const db = initializeFirebase();
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Booking not found' }),
            };
        }

        const booking = bookingDoc.data();

        if (booking.status !== 'pending') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Booking has already been processed' }),
            };
        }

        const gigRef = db.collection('gigs').doc(booking.gigId);
        const gigDoc = await gigRef.get();

        if (!gigDoc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Associated gig not found' }),
            };
        }

        const gig = gigDoc.data();

        if (action === 'approve') {
            // Check if there's still room
            const currentLineup = gig.lineup || [];
            if (currentLineup.length >= gig.slotsTotal) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'No more slots available for this gig' }),
                };
            }

            // Add comedian to lineup
            await gigRef.update({
                lineup: admin.firestore.FieldValue.arrayUnion({
                    comedianId: booking.comedianId,
                    comedianName: booking.comedianName,
                    comedianEmail: booking.comedianEmail,
                    order: currentLineup.length + 1,
                    addedAt: new Date().toISOString(),
                }),
            });

            // Update booking status
            await bookingRef.update({
                status: 'approved',
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                approvedBy: user.email,
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Booking approved successfully',
                    booking: { ...booking, status: 'approved' },
                    sendNotification: true,
                    notificationType: 'booking_approved',
                }),
            };
        } else {
            // Reject booking
            await bookingRef.update({
                status: 'rejected',
                rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
                rejectedBy: user.email,
                rejectionReason: rejectionReason || '',
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Booking rejected',
                    booking: { ...booking, status: 'rejected' },
                }),
            };
        }
    } catch (error) {
        console.error('Error processing booking:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to process booking' }),
        };
    }
};
