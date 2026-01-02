// Admin creates a new gig
const { initializeFirebase, admin } = require('./firebase-init');
const { checkAdmin } = require('./admin-check');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('createGig invoked', { method: event.httpMethod, hasBody: !!event.body });
        const hasAdminToken = !!(event.headers['x-admin-token'] || event.headers['X-Admin-Token']);
        console.log('Auth header presence', { hasAdminToken });
        const adminCheck = checkAdmin(event, context);
        console.log('Admin check result', adminCheck);

        if (!adminCheck.isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Admin access required' }),
            };
        }
        
        const user = { email: adminCheck.email };

        const db = initializeFirebase();
        console.log('Firebase initialized: OK');
        const body = JSON.parse(event.body);
        console.log('Request body parsed', { keys: Object.keys(body || {}) });

        // Handle different HTTP methods
        if (event.httpMethod === 'POST') {
            // Create new gig
            const { venue, date, time, slotsTotal, description, notifyComedians } = body;

            if (!venue || !date || !time || !slotsTotal) {
                const missing = [
                    !venue ? 'venue' : null,
                    !date ? 'date' : null,
                    !time ? 'time' : null,
                    !slotsTotal ? 'slotsTotal' : null,
                ].filter(Boolean);
                console.warn('Create gig validation failed', { missing });
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
            console.log('Gig created', { gigId: gigRef.id, venue, date, time });

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
            console.log('Gig update payload', { gigId, updateKeys: Object.keys(cleanUpdates) });

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
            console.log('Delete gig: bookings to delete', { gigId, count: bookingsSnapshot.size });

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
        if (error && error.stack) console.error('Stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error?.message || 'Failed to process request' }),
        };
    }
};
