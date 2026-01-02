// Admin creates a new gig
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
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
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
        const body = JSON.parse(event.body);

        // Handle different HTTP methods
        if (event.httpMethod === 'POST') {
            // Create new gig
            const { venue, date, time, slotsTotal, description, notifyComedians } = body;

            if (!venue || !date || !time || !slotsTotal) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Venue, date, time, and total slots are required' 
                    }),
                };
            }

            const gigData = {
                venue,
                date,
                time,
                slotsTotal: parseInt(slotsTotal, 10),
                description: description || '',
                status: 'open',
                lineup: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: user.email,
            };

            const gigRef = await db.collection('gigs').add(gigData);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Gig created successfully',
                    gigId: gigRef.id,
                    gig: { id: gigRef.id, ...gigData },
                    notifyComedians: notifyComedians === true,
                }),
            };
        }

        if (event.httpMethod === 'PUT') {
            // Update existing gig
            const { gigId, ...updates } = body;

            if (!gigId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig ID is required' }),
                };
            }

            const gigRef = db.collection('gigs').doc(gigId);
            const gigDoc = await gigRef.get();

            if (!gigDoc.exists) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig not found' }),
                };
            }

            // Clean up updates object
            const allowedFields = ['venue', 'date', 'time', 'slotsTotal', 'description', 'status'];
            const cleanUpdates = {};
            allowedFields.forEach(field => {
                if (updates[field] !== undefined) {
                    cleanUpdates[field] = field === 'slotsTotal' 
                        ? parseInt(updates[field], 10) 
                        : updates[field];
                }
            });

            cleanUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            cleanUpdates.updatedBy = user.email;

            await gigRef.update(cleanUpdates);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Gig updated successfully',
                    gigId,
                }),
            };
        }

        if (event.httpMethod === 'DELETE') {
            // Delete gig
            const { gigId } = body;

            if (!gigId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig ID is required' }),
                };
            }

            const gigRef = db.collection('gigs').doc(gigId);
            const gigDoc = await gigRef.get();

            if (!gigDoc.exists) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig not found' }),
                };
            }

            // Also delete associated bookings
            const bookingsSnapshot = await db.collection('bookings')
                .where('gigId', '==', gigId)
                .get();

            const batch = db.batch();
            bookingsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.delete(gigRef);
            
            await batch.commit();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Gig and associated bookings deleted successfully',
                }),
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };
    } catch (error) {
        console.error('Error managing gig:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to process request' }),
        };
    }
};
