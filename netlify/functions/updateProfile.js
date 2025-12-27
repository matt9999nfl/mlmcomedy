// Comedian updates their profile
const { initializeFirebase, admin } = require('./firebase-init');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        const comedianRef = db.collection('comedians').doc(user.sub);

        if (event.httpMethod === 'GET') {
            // Get profile
            const doc = await comedianRef.get();
            
            if (!doc.exists) {
                // Return default profile from Netlify Identity
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        profile: {
                            userId: user.sub,
                            name: user.user_metadata?.full_name || '',
                            email: user.email,
                            phone: '',
                            bio: '',
                            isNewUser: true,
                        },
                    }),
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    profile: { id: doc.id, ...doc.data() },
                }),
            };
        }

        if (event.httpMethod === 'POST') {
            // Update profile
            const { name, phone, bio } = JSON.parse(event.body);

            const profileData = {
                userId: user.sub,
                email: user.email,
                name: name || user.user_metadata?.full_name || '',
                phone: phone || '',
                bio: bio || '',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Check if profile exists
            const doc = await comedianRef.get();
            
            if (!doc.exists) {
                profileData.createdAt = admin.firestore.FieldValue.serverTimestamp();
            }

            await comedianRef.set(profileData, { merge: true });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Profile updated successfully',
                    profile: profileData,
                }),
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };
    } catch (error) {
        console.error('Error managing profile:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to process request' }),
        };
    }
};
