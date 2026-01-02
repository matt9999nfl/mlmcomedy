// Send email notifications via Resend API
const { initializeFirebase } = require('./firebase-init');
const { checkAdmin } = require('./admin-check');

async function sendEmail(to, subject, html) {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'MLM Comedy <matt@mlmcomedy.com>';
    
    console.log('sendEmail: attempting to send', { 
        to, 
        subject, 
        from: fromEmail,
        hasApiKey: !!apiKey,
        apiKeyPreview: apiKey ? apiKey.slice(0, 8) + '...' : 'MISSING'
    });
    
    if (!apiKey) {
        console.error('sendEmail: RESEND_API_KEY is not set!');
        throw new Error('Email service not configured - RESEND_API_KEY missing');
    }
    
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: fromEmail,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('sendEmail: Resend API error', { status: response.status, error });
        throw new Error(`Resend API error: ${error}`);
    }

    const result = await response.json();
    console.log('sendEmail: success', { id: result.id });
    return result;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

// Email templates
const templates = {
    new_gig: (gig) => ({
        subject: `🎤 New Gig Posted: ${gig.venue} - ${formatDate(gig.date)}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #00ffff;">New Gig Available!</h1>
                <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; color: #fff;">
                    <h2 style="color: #ff00ff;">${gig.venue}</h2>
                    <p><strong>Date:</strong> ${formatDate(gig.date)}</p>
                    <p><strong>Time:</strong> ${gig.time}</p>
                    <p><strong>Slots Available:</strong> ${gig.slotsTotal}</p>
                    ${gig.description ? `<p><strong>Details:</strong> ${gig.description}</p>` : ''}
                </div>
                <p style="margin-top: 20px;">
                    <a href="${process.env.SITE_URL || 'https://mlmcomedy.co.nz'}/portal.html" 
                       style="background: linear-gradient(45deg, #00ffff, #ff00ff); color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Request Your Spot
                    </a>
                </p>
                <p style="color: #888; margin-top: 30px; font-size: 12px;">
                    MLM Comedy - Christchurch's Premier Comedy Production Company
                </p>
            </div>
        `,
    }),

    booking_approved: (booking, gig) => ({
        subject: `✅ You're Booked: ${gig.venue} - ${formatDate(gig.date)}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #00ff00;">Booking Confirmed!</h1>
                <p>Great news, ${booking.comedianName}! Your spot has been approved.</p>
                <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; color: #fff;">
                    <h2 style="color: #ff00ff;">${gig.venue}</h2>
                    <p><strong>Date:</strong> ${formatDate(gig.date)}</p>
                    <p><strong>Time:</strong> ${gig.time}</p>
                    ${gig.description ? `<p><strong>Details:</strong> ${gig.description}</p>` : ''}
                </div>
                <p style="margin-top: 20px;">
                    <a href="${process.env.SITE_URL || 'https://mlmcomedy.co.nz'}/portal.html" 
                       style="background: linear-gradient(45deg, #00ffff, #ff00ff); color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View My Gigs
                    </a>
                </p>
                <p style="color: #888; margin-top: 30px; font-size: 12px;">
                    MLM Comedy - Christchurch's Premier Comedy Production Company
                </p>
            </div>
        `,
    }),

    lineup_updated: (comedian, gig) => ({
        subject: `📋 Lineup Updated: ${gig.venue} - ${formatDate(gig.date)}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #00ffff;">Lineup Update</h1>
                <p>Hi ${comedian.comedianName}, the running order for your upcoming gig has been updated.</p>
                <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; color: #fff;">
                    <h2 style="color: #ff00ff;">${gig.venue}</h2>
                    <p><strong>Date:</strong> ${formatDate(gig.date)}</p>
                    <p><strong>Time:</strong> ${gig.time}</p>
                    <p><strong>Your Position:</strong> #${comedian.order}</p>
                </div>
                <p style="margin-top: 20px;">
                    <a href="${process.env.SITE_URL || 'https://mlmcomedy.co.nz'}/portal.html" 
                       style="background: linear-gradient(45deg, #00ffff, #ff00ff); color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View Full Lineup
                    </a>
                </p>
                <p style="color: #888; margin-top: 30px; font-size: 12px;">
                    MLM Comedy - Christchurch's Premier Comedy Production Company
                </p>
            </div>
        `,
    }),

    gig_reminder: (comedian, gig) => ({
        subject: `⏰ Reminder: Tomorrow - ${gig.venue}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ffff00;">Gig Tomorrow!</h1>
                <p>Hi ${comedian.comedianName}, just a friendly reminder about your gig tomorrow.</p>
                <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; color: #fff;">
                    <h2 style="color: #ff00ff;">${gig.venue}</h2>
                    <p><strong>Date:</strong> ${formatDate(gig.date)}</p>
                    <p><strong>Time:</strong> ${gig.time}</p>
                    <p><strong>Your Position:</strong> #${comedian.order}</p>
                    ${gig.description ? `<p><strong>Details:</strong> ${gig.description}</p>` : ''}
                </div>
                <p style="margin-top: 20px; color: #fff;">
                    Break a leg! 🎤
                </p>
                <p style="color: #888; margin-top: 30px; font-size: 12px;">
                    MLM Comedy - Christchurch's Premier Comedy Production Company
                </p>
            </div>
        `,
    }),
};

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
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
        const adminCheck = checkAdmin(event, context);

        if (!adminCheck.isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Admin access required' }),
            };
        }

        const { type, gigId, bookingId, comedianEmail } = JSON.parse(event.body);
        console.log('sendNotification: request', { type, gigId, bookingId, comedianEmail });

        if (!type) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Notification type is required' }),
            };
        }

        const db = initializeFirebase();
        let emailsSent = 0;

        if (type === 'new_gig' && gigId) {
            console.log('sendNotification: new_gig notification for', gigId);
            // Notify all comedians about new gig
            const gigDoc = await db.collection('gigs').doc(gigId).get();
            if (!gigDoc.exists) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig not found' }),
                };
            }

            const gig = gigDoc.data();
            const comediansSnapshot = await db.collection('comedians').get();
            const emails = [];
            
            comediansSnapshot.forEach(doc => {
                const comedian = doc.data();
                if (comedian.email) emails.push(comedian.email);
            });
            console.log('sendNotification: found comedian emails', { count: emails.length });

            if (emails.length > 0) {
                const template = templates.new_gig(gig);
                await sendEmail(emails, template.subject, template.html);
                emailsSent = emails.length;
            }
        }

        if (type === 'booking_approved' && bookingId) {
            console.log('sendNotification: booking_approved notification for', bookingId);
            // Notify comedian about approved booking
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            if (!bookingDoc.exists) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Booking not found' }),
                };
            }

            const booking = bookingDoc.data();
            const gigDoc = await db.collection('gigs').doc(booking.gigId).get();
            const gig = gigDoc.data();

            const template = templates.booking_approved(booking, gig);
            await sendEmail(booking.comedianEmail, template.subject, template.html);
            emailsSent = 1;
        }

        if (type === 'lineup_updated' && gigId) {
            // Notify all comedians in lineup
            const gigDoc = await db.collection('gigs').doc(gigId).get();
            if (!gigDoc.exists) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig not found' }),
                };
            }

            const gig = gigDoc.data();
            const lineup = gig.lineup || [];

            for (const comedian of lineup) {
                const template = templates.lineup_updated(comedian, gig);
                await sendEmail(comedian.comedianEmail, template.subject, template.html);
                emailsSent++;
            }
        }

        if (type === 'gig_reminder' && gigId) {
            // Send reminder to all comedians in lineup
            const gigDoc = await db.collection('gigs').doc(gigId).get();
            if (!gigDoc.exists) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Gig not found' }),
                };
            }

            const gig = gigDoc.data();
            const lineup = gig.lineup || [];

            for (const comedian of lineup) {
                const template = templates.gig_reminder(comedian, gig);
                await sendEmail(comedian.comedianEmail, template.subject, template.html);
                emailsSent++;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Notifications sent successfully`,
                emailsSent,
            }),
        };
    } catch (error) {
        console.error('Error sending notification:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to send notification' }),
        };
    }
};
