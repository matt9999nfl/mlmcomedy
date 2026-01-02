// Admin updates lineup order or removes comedians from lineup
const { initializeFirebase, admin } = require('./firebase-init');

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

        const { gigId, lineup, action, comedianId, notifyComedians } = JSON.parse(event.body);

        if (!gigId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Gig ID is required' }),
            };
        }

        const db = initializeFirebase();
        const gigRef = db.collection('gigs').doc(gigId);
        const gigDoc = await gigRef.get();

        if (!gigDoc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Gig not found' }),
            };
        }

        const gig = gigDoc.data();

        // Handle different actions
        if (action === 'reorder' && lineup) {
            // Reorder lineup - lineup should be an array of comedian objects with new order
            const reorderedLineup = lineup.map((item, index) => ({
                ...item,
                order: index + 1,
            }));

            await gigRef.update({
                lineup: reorderedLineup,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: user.email,
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Lineup reordered successfully',
                    lineup: reorderedLineup,
                    notifyComedians: notifyComedians === true,
                }),
            };
        }

        if (action === 'remove' && comedianId) {
            // Remove comedian from lineup
            const currentLineup = gig.lineup || [];
            const updatedLineup = currentLineup
                .filter(c => c.comedianId !== comedianId)
                .map((item, index) => ({
                    ...item,
                    order: index + 1,
                }));

            // Update gig lineup
            await gigRef.update({
                lineup: updatedLineup,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: user.email,
            });

            // Update booking status
            const bookingsSnapshot = await db.collection('bookings')
                .where('gigId', '==', gigId)
                .where('comedianId', '==', comedianId)
                .where('status', '==', 'approved')
                .get();

            const batch = db.batch();
            bookingsSnapshot.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'removed',
                    removedAt: admin.firestore.FieldValue.serverTimestamp(),
                    removedBy: user.email,
                });
            });
            await batch.commit();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Comedian removed from lineup',
                    lineup: updatedLineup,
                }),
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Invalid action. Use "reorder" with lineup array or "remove" with comedianId' 
            }),
        };
    } catch (error) {
        console.error('Error updating lineup:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to update lineup' }),
        };
    }
};
