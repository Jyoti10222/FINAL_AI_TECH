// ===========================
// COUNSELLOR BOOKINGS ROUTES
// ===========================
// Add these routes to server.js

// Path definition (add to top of server.js with other paths):
// const counsellorBookingsPath = path.join(__dirname, 'counsellor-bookings.json');

// GET - Retrieve all counsellor bookings
app.get('/api/counsellor-bookings', (req, res) => {
    try {
        const data = fs.readFileSync(counsellorBookingsPath, 'utf8');
        const bookingsData = JSON.parse(data);
        res.json({
            success: true,
            data: bookingsData.bookings || []
        });
    } catch (error) {
        console.error('Error reading counsellor bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to read counsellor bookings'
        });
    }
});

// POST - Submit a new counsellor booking
app.post('/api/counsellor-bookings', (req, res) => {
    try {
        const { name, email, phone, course, notes, selectedDate, selectedTime, mode, submittedAt } = req.body;

        const data = fs.readFileSync(counsellorBookingsPath, 'utf8');
        const bookingsData = JSON.parse(data);

        const newBooking = {
            id: crypto.randomBytes(16).toString('hex'),
            name,
            email,
            phone,
            course,
            notes: notes || '',
            selectedDate,
            selectedTime,
            mode, // 'online' or 'face-to-face'
            submittedAt: submittedAt || new Date().toISOString(),
            status: 'pending',
            assignedCounselor: null,
            meetingLink: null,
            locationAddress: null,
            adminNotes: null
        };

        bookingsData.bookings.push(newBooking);
        fs.writeFileSync(counsellorBookingsPath, JSON.stringify(bookingsData, null, 2));

        res.json({
            success: true,
            message: 'Booking submitted successfully',
            data: newBooking
        });
    } catch (error) {
        console.error('Error submitting booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit booking'
        });
    }
});

// POST - Assign counselor to a booking
app.post('/api/counsellor-bookings/assign', async (req, res) => {
    try {
        const { bookingId, counselor, meetingLink, locationAddress, notes } = req.body;

        const data = fs.readFileSync(counsellorBookingsPath, 'utf8');
        const bookingsData = JSON.parse(data);

        const bookingIndex = bookingsData.bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Update booking
        bookingsData.bookings[bookingIndex].status = 'assigned';
        bookingsData.bookings[bookingIndex].assignedCounselor = counselor;
        bookingsData.bookings[bookingIndex].meetingLink = meetingLink || null;
        bookingsData.bookings[bookingIndex].locationAddress = locationAddress || null;
        bookingsData.bookings[bookingIndex].adminNotes = notes || null;
        bookingsData.bookings[bookingIndex].assignedAt = new Date().toISOString();

        fs.writeFileSync(counsellorBookingsPath, JSON.stringify(bookingsData, null, 2));

        // Send confirmation email to student
        const booking = bookingsData.bookings[bookingIndex];
        if (transporter) {
            try {
                const date = new Date(booking.selectedDate);
                const dateStr = date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const mailOptions = {
                    from: emailConfig.email.auth.user,
                    to: booking.email,
                    subject: 'Counseling Session Confirmed - AI-TECH PRO',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
                                .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                                .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                                .info-card { background: #F9FAFB; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4F46E5; }
                                .info-row { display: flex; margin-bottom: 12px; }
                                .info-label { font-weight: 600; color: #6B7280; min-width: 120px; }
                                .info-value { color: #111827; }
                                .button { display: inline-block; padding: 14px 32px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                                .button:hover { background: #4338CA; }
                                .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 13px; }
                                .alert { background: #EEF2FF; border: 1px solid #C7D2FE; padding: 16px; border-radius: 8px; margin: 20px 0; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>🎓 Counseling Session Confirmed!</h1>
                                </div>
                                <div class="content">
                                    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${booking.name},</p>
                                    <p>Great news! Your counseling session has been confirmed. We've assigned an expert counselor to guide you.</p>
                                    
                                    <div class="info-card">
                                        <h3 style="margin-top: 0; color: #4F46E5; font-size: 18px;">Session Details</h3>
                                        <div class="info-row">
                                            <div class="info-label">📅 Date:</div>
                                            <div class="info-value">${dateStr}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">⏰ Time:</div>
                                            <div class="info-value">${booking.selectedTime}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">📚 Course:</div>
                                            <div class="info-value">${booking.course}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">👤 Counselor:</div>
                                            <div class="info-value">${counselor}</div>
                                        </div>
                                    </div>
                                    
                                    ${booking.mode === 'online' && meetingLink ? `
                                        <div class="alert">
                                            <p style="margin: 0; font-weight: 600; color: #4F46E5;">🎥 Online Session</p>
                                            <p style="margin: 10px 0 0 0;">Join your session using the link below:</p>
                                        </div>
                                        <center>
                                            <a href="${meetingLink}" class="button">Join Video Call</a>
                                        </center>
                                        <p style="font-size: 13px; color: #6B7280; text-align: center;">Meeting Link: ${meetingLink}</p>
                                    ` : `
                                        <div class="alert">
                                            <p style="margin: 0; font-weight: 600; color: #4F46E5;">📍 Face-to-Face Session</p>
                                            <p style="margin: 10px 0 0 0;"><strong>Location:</strong><br>${locationAddress}</p>
                                        </div>
                                    `}
                                    
                                    ${notes ? `
                                        <div class="info-card">
                                            <h4 style="margin-top: 0; color: #4F46E5;">📝 Additional Notes</h4>
                                            <p style="margin: 0;">${notes}</p>
                                        </div>
                                    ` : ''}
                                    
                                    <p style="margin-top: 30px;">If you need to reschedule or have any questions, please contact us at support@aitech.pro</p>
                                    
                                    <p style="margin-top: 20px;">Best regards,<br>
                                    <strong>AI-TECH PRO Career Counseling Team</strong></p>
                                </div>
                                <div class="footer">
                                    <p>© 2024 AI-TECH PRO LMS. All rights reserved.</p>
                                    <p>This is an automated message. Please do not reply directly to this email.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`✅ Confirmation email sent to ${booking.email}`);
            } catch (emailError) {
                console.error('❌ Failed to send confirmation email:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Counselor assigned successfully',
            data: bookingsData.bookings[bookingIndex]
        });
    } catch (error) {
        console.error('Error assigning counselor:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign counselor'
        });
    }
});

// POST - Mark booking as completed
app.post('/api/counsellor-bookings/complete', (req, res) => {
    try {
        const { bookingId } = req.body;

        const data = fs.readFileSync(counsellorBookingsPath, 'utf8');
        const bookingsData = JSON.parse(data);

        const bookingIndex = bookingsData.bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        bookingsData.bookings[bookingIndex].status = 'completed';
        bookingsData.bookings[bookingIndex].completedAt = new Date().toISOString();

        fs.writeFileSync(counsellorBookingsPath, JSON.stringify(bookingsData, null, 2));

        res.json({
            success: true,
            message: 'Booking marked as completed',
            data: bookingsData.bookings[bookingIndex]
        });
    } catch (error) {
        console.error('Error completing booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete booking'
        });
    }
});
