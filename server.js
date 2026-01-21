const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const emailConfig = require('./email-config');

// Email Transporter Setup
let transporter = null;
try {
    if (emailConfig && emailConfig.email && emailConfig.email.auth) {
        transporter = nodemailer.createTransport({
            service: emailConfig.email.service,
            auth: {
                user: emailConfig.email.auth.user,
                pass: emailConfig.email.auth.pass
            }
        });
        console.log('📧 Email Service: Configured');
    } else {
        console.warn('⚠️ Email Config: Missing credentials in email-config.js');
    }
} catch (error) {
    console.warn('⚠️ Email Service: Failed to initialize', error.message);
}

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend files

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        serverId: 'TECH_PRO_BACKEND_V5',
        timestamp: new Date().toISOString(),
        message: 'TECH-PRO AI Backend is running'
    });
});

// Students Endpoint for Admin Dashboard
app.get('/api/students', (req, res) => {
    try {
        const studentsPath = path.join(__dirname, 'students.json');
        if (fs.existsSync(studentsPath)) {
            const data = fs.readFileSync(studentsPath, 'utf8');
            res.json({ success: true, data: JSON.parse(data).students });
        } else {
            res.json({ success: true, data: [] });
        }
    } catch (error) {
        console.error('Error reading students:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch students' });
    }
});

// Config file paths for each payment page
const configPaths = {
    'pay': path.join(__dirname, 'config-pay.json'),
    'pay1': path.join(__dirname, 'config-pay1.json'),
    'pay2': path.join(__dirname, 'config-pay2.json'),
    'online': path.join(__dirname, 'config-online.json')
};

// Explicit config paths for specific endpoints
const onlineConfigPath = configPaths.online;
const offlineConfigPath = path.join(__dirname, 'config-offline.json');
const hybridConfigPath = path.join(__dirname, 'config-hybrid.json');
const batchRequestsPath = path.join(__dirname, 'batch-requests.json');
const counsellorQueriesPath = path.join(__dirname, 'counsellor-queries.json');
const counsellorBookingsPath = path.join(__dirname, 'counsellor-bookings.json');

// AI Learning config path
const aiLearningConfigPath = path.join(__dirname, 'config-ailearning.json');

// Helper function to read config
const readConfig = (pageId) => {
    try {
        const configPath = configPaths[pageId];
        if (!configPath) return null;
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading config for ${pageId}:`, error);
        return null;
    }
};

// Helper function to write config
const writeConfig = (pageId, config) => {
    try {
        const configPath = configPaths[pageId];
        if (!configPath) return false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing config for ${pageId}:`, error);
        return false;
    }
};

// =====================
// PAYMENT CONFIG ROUTES
// =====================

// GET - Retrieve payment config for a specific page
app.get('/api/payment-config/:pageId', (req, res) => {
    const { pageId } = req.params;

    if (!configPaths[pageId]) {
        return res.status(400).json({
            success: false,
            message: `Invalid page ID. Use: pay, pay1, pay2, or online`
        });
    }

    const config = readConfig(pageId);
    if (config) {
        res.json({
            success: true,
            pageId,
            data: config
        });
    } else {
        res.status(500).json({
            success: false,
            message: `Failed to read payment configuration for ${pageId}`
        });
    }
});

// GET - Retrieve all payment configs
app.get('/api/payment-config', (req, res) => {
    const allConfigs = {};
    for (const pageId of Object.keys(configPaths)) {
        allConfigs[pageId] = readConfig(pageId);
    }
    res.json({
        success: true,
        data: allConfigs
    });
});

// PUT - Update payment config for a specific page
app.put('/api/payment-config/:pageId', (req, res) => {
    const { pageId } = req.params;

    if (!configPaths[pageId]) {
        return res.status(400).json({
            success: false,
            message: `Invalid page ID. Use: pay, pay1, pay2, or online`
        });
    }

    // Handle both one-time payment and subscription models
    const { originalPrice, discount, totalAmount, discountLabel, courseName, courseDuration, price, period, description, title } = req.body;

    const currentConfig = readConfig(pageId);
    if (!currentConfig) {
        return res.status(500).json({
            success: false,
            message: `Failed to read current configuration for ${pageId}`
        });
    }

    let updatedConfig;
    if (pageId === 'online') {
        // Subscription model for Online.html
        updatedConfig = {
            ...currentConfig,
            ...(price !== undefined && { price }),
            ...(period !== undefined && { period }),
            ...(description !== undefined && { description }),
            ...(title !== undefined && { title })
        };
    } else {
        // One-time payment model for Pay, Pay1, Pay2
        updatedConfig = {
            ...currentConfig,
            ...(originalPrice !== undefined && { originalPrice }),
            ...(discount !== undefined && { discount }),
            ...(totalAmount !== undefined && { totalAmount }),
            ...(discountLabel !== undefined && { discountLabel }),
            ...(courseName !== undefined && { courseName }),
            ...(courseDuration !== undefined && { courseDuration })
        };
    }

    if (writeConfig(pageId, updatedConfig)) {
        res.json({
            success: true,
            message: `Payment configuration for ${pageId} updated successfully`,
            data: updatedConfig
        });
    } else {
        res.status(500).json({
            success: false,
            message: `Failed to update payment configuration for ${pageId}`
        });
    }
});

// ========================
// AI LEARNING CONFIG ROUTES
// ========================

// GET - Retrieve AI Learning config
app.get('/api/ailearning-config', (req, res) => {
    try {
        const data = fs.readFileSync(aiLearningConfigPath, 'utf8');
        const config = JSON.parse(data);
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error reading AI learning config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to read AI learning configuration'
        });
    }
});

// PUT - Update subscription
app.put('/api/ailearning-config/subscription', (req, res) => {
    try {
        const data = fs.readFileSync(aiLearningConfigPath, 'utf8');
        const config = JSON.parse(data);

        const { price, period } = req.body;
        if (price !== undefined) config.subscription.price = price;
        if (period !== undefined) config.subscription.period = period;

        fs.writeFileSync(aiLearningConfigPath, JSON.stringify(config, null, 2));
        res.json({
            success: true,
            message: 'Subscription updated successfully',
            data: config.subscription
        });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to update subscription' });
    }
});

// PUT - Update a specific course
app.put('/api/ailearning-config/course/:courseId', (req, res) => {
    try {
        const data = fs.readFileSync(aiLearningConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { courseId } = req.params;

        const courseIndex = config.courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) {
            return res.status(404).json({ success: false, message: `Course '${courseId}' not found` });
        }

        const { name, category, description, price, duration, link } = req.body;
        if (name !== undefined) config.courses[courseIndex].name = name;
        if (category !== undefined) config.courses[courseIndex].category = category;
        if (description !== undefined) config.courses[courseIndex].description = description;
        if (price !== undefined) config.courses[courseIndex].price = price;
        if (duration !== undefined) config.courses[courseIndex].duration = duration;
        if (link !== undefined) config.courses[courseIndex].link = link;

        fs.writeFileSync(aiLearningConfigPath, JSON.stringify(config, null, 2));
        res.json({
            success: true,
            message: `Course '${courseId}' updated successfully`,
            data: config.courses[courseIndex]
        });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ success: false, message: 'Failed to update course' });
    }
});

// ========================
// ONLINE COURSES CONFIG ROUTES
// ========================
// Config path defined globally

// GET - Retrieve Online courses config
app.get('/api/online-config', (req, res) => {
    try {
        const data = fs.readFileSync(onlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error reading online config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to read online configuration'
        });
    }
});

// PUT - Update entire online config
app.put('/api/online-config', (req, res) => {
    try {
        const data = fs.readFileSync(onlineConfigPath, 'utf8');
        const config = JSON.parse(data);

        // Update with new data
        const updatedConfig = {
            ...config,
            ...req.body
        };

        fs.writeFileSync(onlineConfigPath, JSON.stringify(updatedConfig, null, 2));
        res.json({ success: true, message: 'Online config updated', data: updatedConfig });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update online config' });
    }
});


// PUT - Update Batch List (for Faculty Grid)
app.put('/api/online-config/batches', (req, res) => {
    try {
        const data = fs.readFileSync(onlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { batches } = req.body;

        if (!Array.isArray(batches)) {
            return res.status(400).json({ success: false, message: 'Batches must be an array' });
        }

        config.batches = batches;
        fs.writeFileSync(onlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Batches updated successfully', data: config.batches });
    } catch (error) {
        console.error('Error updating batches:', error);
        res.status(500).json({ success: false, message: 'Failed to update batches' });
    }
});

// PUT - Update access fee
app.put('/api/online-config/accessfee', (req, res) => {
    try {
        const data = fs.readFileSync(onlineConfigPath, 'utf8');
        const config = JSON.parse(data);

        const { price, period, description } = req.body;
        if (price !== undefined) config.accessFee.price = price;
        if (period !== undefined) config.accessFee.period = period;
        if (description !== undefined) config.accessFee.description = description;

        fs.writeFileSync(onlineConfigPath, JSON.stringify(config, null, 2));
        res.json({
            success: true,
            message: 'Access fee updated successfully',
            data: config.accessFee
        });
    } catch (error) {
        console.error('Error updating access fee:', error);
        res.status(500).json({ success: false, message: 'Failed to update access fee' });
    }
});

// ====================
// HYBRID CONFIG ROUTES
// ====================

// GET - Retrieve Hybrid config
app.get('/api/hybrid-config', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error reading hybrid config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to read hybrid configuration'
        });
    }
});

// PUT - Update Hybrid config
app.put('/api/hybrid-config', (req, res) => {
    try {
        const currentData = fs.readFileSync(hybridConfigPath, 'utf8');
        const currentConfig = JSON.parse(currentData);

        // Merge the request body into the current config
        const updatedConfig = { ...currentConfig, ...req.body };

        fs.writeFileSync(hybridConfigPath, JSON.stringify(updatedConfig, null, 2));

        res.json({
            success: true,
            message: 'Hybrid configuration updated successfully',
            data: updatedConfig
        });
    } catch (error) {
        console.error('Error updating hybrid config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update hybrid configuration'
        });
    }
});

// PUT - Update a specific online course
app.put('/api/online-config/course/:courseId', (req, res) => {
    try {
        const data = fs.readFileSync(onlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { courseId } = req.params;

        const courseIndex = config.courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) {
            return res.status(404).json({ success: false, message: `Course '${courseId}' not found` });
        }

        const { name, price, duration, batchCount, icon, color } = req.body;
        if (name !== undefined) config.courses[courseIndex].name = name;
        if (price !== undefined) config.courses[courseIndex].price = price;
        if (duration !== undefined) config.courses[courseIndex].duration = duration;
        if (batchCount !== undefined) config.courses[courseIndex].batchCount = batchCount;
        if (icon !== undefined) config.courses[courseIndex].icon = icon;
        if (color !== undefined) config.courses[courseIndex].color = color;

        fs.writeFileSync(onlineConfigPath, JSON.stringify(config, null, 2));
        res.json({
            success: true,
            message: `Course '${courseId}' updated successfully`,
            data: config.courses[courseIndex]
        });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ success: false, message: 'Failed to update course' });
    }
});

// ===========================
// COUNSELLOR BOOKINGS ROUTES
// ===========================

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
            mode,
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
        const { bookingId, counselorName, counselorEmail, meetingLink, locationAddress, notes } = req.body;

        const data = fs.readFileSync(counsellorBookingsPath, 'utf8');
        const bookingsData = JSON.parse(data);

        const bookingIndex = bookingsData.bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        bookingsData.bookings[bookingIndex].status = 'assigned';
        bookingsData.bookings[bookingIndex].assignedCounselor = counselorName;
        bookingsData.bookings[bookingIndex].counselorEmail = counselorEmail;
        bookingsData.bookings[bookingIndex].meetingLink = meetingLink || null;
        bookingsData.bookings[bookingIndex].locationAddress = locationAddress || null;
        bookingsData.bookings[bookingIndex].adminNotes = notes || null;
        bookingsData.bookings[bookingIndex].assignedAt = new Date().toISOString();

        fs.writeFileSync(counsellorBookingsPath, JSON.stringify(bookingsData, null, 2));

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
                                            <div class="info-value">${counselorName}</div>
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

                // Email to COUNSELOR
                const counselorMailOptions = {
                    from: emailConfig.email.auth.user,
                    to: counselorEmail,
                    subject: 'New Counseling Session Assigned - AI-TECH PRO',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
                                .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                                .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                                .info-card { background: #F0FDF4; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #10B981; }
                                .info-row { display: flex; margin-bottom: 12px; }
                                .info-label { font-weight: 600; color: #6B7280; min-width: 140px; }
                                .info-value { color: #111827; }
                                .button { display: inline-block; padding: 14px 32px; background: #10B981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                                .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 13px; }
                                .alert { background: #DBEAFE; border: 1px solid #93C5FD; padding: 16px; border-radius: 8px; margin: 20px 0; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>📋 New Session Assigned!</h1>
                                </div>
                                <div class="content">
                                    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${counselorName},</p>
                                    <p>You have been assigned to a new counseling session. Please review the details below:</p>
                                    
                                    <div class="info-card">
                                        <h3 style="margin-top: 0; color: #10B981; font-size: 18px;">Student Information</h3>
                                        <div class="info-row">
                                            <div class="info-label">👤 Student Name:</div>
                                            <div class="info-value">${booking.name}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">📧 Email:</div>
                                            <div class="info-value">${booking.email}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">📱 Phone:</div>
                                            <div class="info-value">${booking.phone}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">📚 Course Interest:</div>
                                            <div class="info-value">${booking.course}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="info-card">
                                        <h3 style="margin-top: 0; color: #10B981; font-size: 18px;">Session Details</h3>
                                        <div class="info-row">
                                            <div class="info-label">📅 Date:</div>
                                            <div class="info-value">${dateStr}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">⏰ Time:</div>
                                            <div class="info-value">${booking.selectedTime}</div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-label">🎯 Mode:</div>
                                            <div class="info-value">${booking.mode === 'online' ? 'Online (Video Call)' : 'Face-to-Face (Institute Visit)'}</div>
                                        </div>
                                    </div>
                                    
                                    ${booking.notes ? `
                                        <div class="alert">
                                            <p style="margin: 0; font-weight: 600; color: #1E40AF;">💬 Student's Query/Notes:</p>
                                            <p style="margin: 10px 0 0 0;">${booking.notes}</p>
                                        </div>
                                    ` : ''}
                                    
                                    ${booking.mode === 'online' && meetingLink ? `
                                        <div class="alert">
                                            <p style="margin: 0; font-weight: 600; color: #1E40AF;">🎥 Google Meet Link:</p>
                                            <p style="margin: 10px 0 0 0;">Use this link for the session:</p>
                                        </div>
                                        <center>
                                            <a href="${meetingLink}" class="button">Join Video Call</a>
                                        </center>
                                        <p style="font-size: 13px; color: #6B7280; text-align: center;">Meeting Link: ${meetingLink}</p>
                                    ` : `
                                        <div class="alert">
                                            <p style="margin: 0; font-weight: 600; color: #1E40AF;">📍 Meeting Location:</p>
                                            <p style="margin: 10px 0 0 0;">${locationAddress}</p>
                                        </div>
                                    `}
                                    
                                    ${notes ? `
                                        <div class="info-card">
                                            <h4 style="margin-top: 0; color: #10B981;">📝 Admin Notes</h4>
                                            <p style="margin: 0;">${notes}</p>
                                        </div>
                                    ` : ''}
                                    
                                    <p style="margin-top: 30px;">Please ensure you're prepared for the session. If you need to reschedule, contact the admin team immediately.</p>
                                    
                                    <p style="margin-top: 20px;">Best regards,<br>
                                    <strong>AI-TECH PRO Admin Team</strong></p>
                                </div>
                                <div class="footer">
                                    <p>© 2024 AI-TECH PRO LMS. All rights reserved.</p>
                                    <p>This is an automated notification. For support, contact admin@aitech.pro</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                };

                await transporter.sendMail(counselorMailOptions);
                console.log(`✅ Assignment notification sent to counselor: ${counselorEmail}`);
            } catch (emailError) {
                console.error('❌ Failed to send emails:', emailError);
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

// ===================================
// COUNSELLOR REMINDER NOTIFICATION SYSTEM
// ===================================

// Function to check and send reminder notifications
function checkAndSendReminders() {
    try {
        const data = fs.readFileSync(counsellorBookingsPath, 'utf8');
        const bookingsData = JSON.parse(data);

        const now = new Date();

        bookingsData.bookings.forEach(async (booking) => {
            if (booking.status !== 'assigned') return;
            if (booking.reminderSent) return;

            const bookingDate = new Date(booking.selectedDate);
            const [time, period] = booking.selectedTime.split(' ');
            let [hours, minutes] = time.split(':').map(Number);

            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            bookingDate.setHours(hours, minutes, 0, 0);
            const timeDiff = (bookingDate - now) / (1000 * 60);

            if (timeDiff > 29 && timeDiff <= 31) {
                console.log(`⏰ Sending 30-minute reminder for booking ${booking.id}`);

                if (transporter) {
                    const dateStr = bookingDate.toLocaleDateString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    });

                    const studentReminderOptions = {
                        from: emailConfig.email.auth.user,
                        to: booking.email,
                        subject: '⏰ Reminder: Counseling Session in 30 Minutes - AI-TECH PRO',
                        html: `<!DOCTYPE html><html><head><style>body{font-family:'Inter',Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);color:white;padding:40px 30px;text-align:center;border-radius:12px 12px 0 0}.header h1{margin:0;font-size:28px;font-weight:700}.content{background:#fff;padding:40px 30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.reminder-box{background:#FEF3C7;border:2px solid #F59E0B;padding:20px;border-radius:10px;margin:20px 0;text-align:center}.info-card{background:#F9FAFB;padding:20px;border-radius:10px;margin:20px 0;border-left:4px solid #F59E0B}.info-row{display:flex;margin-bottom:12px}.info-label{font-weight:600;color:#6B7280;min-width:120px}.info-value{color:#111827}.button{display:inline-block;padding:14px 32px;background:#F59E0B;color:white;text-decoration:none;border-radius:8px;margin:20px 0;font-weight:600}.footer{text-align:center;margin-top:30px;color:#6B7280;font-size:13px}</style></head><body><div class="container"><div class="header"><h1>⏰ Session Starting Soon!</h1></div><div class="content"><div class="reminder-box"><h2 style="margin:0;color:#D97706;font-size:24px">Your session starts in 30 minutes!</h2></div><p style="font-size:16px;margin-bottom:20px">Dear ${booking.name},</p><p>This is a friendly reminder that your counseling session is starting soon.</p><div class="info-card"><h3 style="margin-top:0;color:#F59E0B;font-size:18px">Session Details</h3><div class="info-row"><div class="info-label">📅 Date:</div><div class="info-value">${dateStr}</div></div><div class="info-row"><div class="info-label">⏰ Time:</div><div class="info-value">${booking.selectedTime}</div></div><div class="info-row"><div class="info-label">👤 Counselor:</div><div class="info-value">${booking.assignedCounselor}</div></div></div>${booking.mode === 'online' && booking.meetingLink ? `<center><a href="${booking.meetingLink}" class="button">Join Video Call Now</a></center><p style="font-size:13px;color:#6B7280;text-align:center">Meeting Link: ${booking.meetingLink}</p>` : `<div class="info-card"><h4 style="margin-top:0;color:#F59E0B">📍 Location</h4><p style="margin:0">${booking.locationAddress}</p></div>`}<p style="margin-top:30px">Please be ready to join on time. Looking forward to our session!</p><p style="margin-top:20px">Best regards,<br><strong>AI-TECH PRO Career Counseling Team</strong></p></div><div class="footer"><p>© 2024 AI-TECH PRO LMS. All rights reserved.</p></div></div></body></html>`
                    };

                    const counselorReminderOptions = {
                        from: emailConfig.email.auth.user,
                        to: booking.counselorEmail,
                        subject: '⏰ Reminder: Counseling Session in 30 Minutes - AI-TECH PRO',
                        html: `<!DOCTYPE html><html><head><style>body{font-family:'Inter',Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);color:white;padding:40px 30px;text-align:center;border-radius:12px 12px 0 0}.header h1{margin:0;font-size:28px;font-weight:700}.content{background:#fff;padding:40px 30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.reminder-box{background:#FEF3C7;border:2px solid #F59E0B;padding:20px;border-radius:10px;margin:20px 0;text-align:center}.info-card{background:#FEF2F2;padding:20px;border-radius:10px;margin:20px 0;border-left:4px solid #F59E0B}.info-row{display:flex;margin-bottom:12px}.info-label{font-weight:600;color:#6B7280;min-width:140px}.info-value{color:#111827}.button{display:inline-block;padding:14px 32px;background:#F59E0B;color:white;text-decoration:none;border-radius:8px;margin:20px 0;font-weight:600}.footer{text-align:center;margin-top:30px;color:#6B7280;font-size:13px}</style></head><body><div class="container"><div class="header"><h1>⏰ Session Starting Soon!</h1></div><div class="content"><div class="reminder-box"><h2 style="margin:0;color:#D97706;font-size:24px">Your session starts in 30 minutes!</h2></div><p style="font-size:16px;margin-bottom:20px">Dear ${booking.assignedCounselor},</p><p>This is a friendly reminder about your upcoming counseling session.</p><div class="info-card"><h3 style="margin-top:0;color:#F59E0B;font-size:18px">Student Information</h3><div class="info-row"><div class="info-label">👤 Student Name:</div><div class="info-value">${booking.name}</div></div><div class="info-row"><div class="info-label">📧 Email:</div><div class="info-value">${booking.email}</div></div><div class="info-row"><div class="info-label">📱 Phone:</div><div class="info-value">${booking.phone}</div></div><div class="info-row"><div class="info-label">📚 Course:</div><div class="info-value">${booking.course}</div></div></div><div class="info-card"><h3 style="margin-top:0;color:#F59E0B;font-size:18px">Session Details</h3><div class="info-row"><div class="info-label">📅 Date:</div><div class="info-value">${dateStr}</div></div><div class="info-row"><div class="info-label">⏰ Time:</div><div class="info-value">${booking.selectedTime}</div></div></div>${booking.mode === 'online' && booking.meetingLink ? `<center><a href="${booking.meetingLink}" class="button">Join Video Call Now</a></center><p style="font-size:13px;color:#6B7280;text-align:center">Meeting Link: ${booking.meetingLink}</p>` : `<div class="info-card"><h4 style="margin-top:0;color:#F59E0B">📍 Location</h4><p style="margin:0">${booking.locationAddress}</p></div>`}<p style="margin-top:30px">Please be ready to start the session on time. Thank you!</p><p style="margin-top:20px">Best regards,<br><strong>AI-TECH PRO Admin Team</strong></p></div><div class="footer"><p>© 2024 AI-TECH PRO LMS. All rights reserved.</p></div></div></body></html>`
                    };

                    try {
                        await transporter.sendMail(studentReminderOptions);
                        console.log(`✅ Reminder sent to student: ${booking.email}`);

                        await transporter.sendMail(counselorReminderOptions);
                        console.log(`✅ Reminder sent to counselor: ${booking.counselorEmail}`);

                        booking.reminderSent = true;
                        fs.writeFileSync(counsellorBookingsPath, JSON.stringify(bookingsData, null, 2));
                    } catch (emailError) {
                        console.error('❌ Failed to send reminder emails:', emailError);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error checking reminders:', error);
    }
}

setInterval(checkAndSendReminders, 60000);
checkAndSendReminders();
console.log('⏰ Reminder notification system activated - checking every minute');

// ========================
// OFFLINE BATCH CONFIG ROUTES
// ========================
// Config path defined globally

// GET - Retrieve Offline batch config
app.get('/api/offline-config', (req, res) => {
    try {
        const data = fs.readFileSync(offlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('Error reading offline config:', error);
        res.status(500).json({ success: false, message: 'Failed to read offline configuration' });
    }
});

// PUT - Update batch fee
app.put('/api/offline-config/batchfee', (req, res) => {
    try {
        const data = fs.readFileSync(offlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { price, currency } = req.body;
        if (price !== undefined) config.batchFee.price = price;
        if (currency !== undefined) config.batchFee.currency = currency;
        fs.writeFileSync(offlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Batch fee updated', data: config.batchFee });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update batch fee' });
    }
});

// PUT - Update stats
app.put('/api/offline-config/stats', (req, res) => {
    try {
        const data = fs.readFileSync(offlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { available, fastFilling } = req.body;
        if (available !== undefined) config.stats.available = available;
        if (fastFilling !== undefined) config.stats.fastFilling = fastFilling;
        fs.writeFileSync(offlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Stats updated', data: config.stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update stats' });
    }
});

// PUT - Update a specific offline course
app.put('/api/offline-config/course/:courseId', (req, res) => {
    try {
        const data = fs.readFileSync(offlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { courseId } = req.params;
        const courseIndex = config.courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) {
            return res.status(404).json({ success: false, message: `Course '${courseId}' not found` });
        }
        const { name, category, room, price, totalSeats, enrolledSeats, duration, instructor } = req.body;
        if (name !== undefined) config.courses[courseIndex].name = name;
        if (category !== undefined) config.courses[courseIndex].category = category;
        if (room !== undefined) config.courses[courseIndex].room = room;
        if (price !== undefined) config.courses[courseIndex].price = price;
        if (totalSeats !== undefined) config.courses[courseIndex].totalSeats = totalSeats;
        if (enrolledSeats !== undefined) config.courses[courseIndex].enrolledSeats = enrolledSeats;
        if (duration !== undefined) config.courses[courseIndex].duration = duration;
        if (instructor !== undefined) config.courses[courseIndex].instructor = instructor;
        fs.writeFileSync(offlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: `Course updated`, data: config.courses[courseIndex] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update course' });
    }
});

// ========================
// HYBRID BATCH CONFIG ROUTES
// ========================
// Config path defined globally

// GET - Retrieve Hybrid batch config
app.get('/api/hybrid-config', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('Error reading hybrid config:', error);
        res.status(500).json({ success: false, message: 'Failed to read hybrid configuration' });
    }
});

// PUT - Update entire hybrid config
app.put('/api/hybrid-config', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);

        // Update with new data
        const updatedConfig = {
            ...config,
            ...req.body
        };

        fs.writeFileSync(hybridConfigPath, JSON.stringify(updatedConfig, null, 2));
        res.json({ success: true, message: 'Hybrid config updated', data: updatedConfig });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update hybrid config' });
    }
});

// PUT - Update page info
app.put('/api/hybrid-config/pageinfo', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { title, subtitle } = req.body;
        if (title) config.pageInfo.title = title;
        if (subtitle) config.pageInfo.subtitle = subtitle;
        fs.writeFileSync(hybridConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Page info updated', data: config.pageInfo });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update page info' });
    }
});

// PUT - Update access fee
app.put('/api/hybrid-config/accessfee', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { price, period, description } = req.body;
        if (!config.accessFee) config.accessFee = {};
        if (price !== undefined) config.accessFee.price = price;
        if (period !== undefined) config.accessFee.period = period;
        if (description !== undefined) config.accessFee.description = description;
        fs.writeFileSync(hybridConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Access fee updated', data: config.accessFee });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update access fee' });
    }
});

// PUT - Update a specific hybrid course
app.put('/api/hybrid-config/course/:courseId', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { courseId } = req.params;
        const courseIndex = config.courses.findIndex(c => c.id === courseId);

        if (courseIndex === -1) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Update course fields
        const updates = req.body;
        Object.keys(updates).forEach(key => {
            if (key !== 'id') {
                config.courses[courseIndex][key] = updates[key];
            }
        });

        fs.writeFileSync(hybridConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: `Course updated`, data: config.courses[courseIndex] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update course' });
    }
});

// POST - Add new online course
app.post('/api/online-config/course', (req, res) => {
    try {
        const data = fs.readFileSync(onlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { name, price, duration, batchCount, icon, color } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Course name is required' });
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const newCourse = {
            id,
            name,
            icon: icon || 'school',
            color: color || 'blue',
            price: price || 0,
            duration: duration || '3 Months',
            batchCount: batchCount || 1
        };

        config.courses.push(newCourse);
        fs.writeFileSync(onlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Course added', data: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add course' });
    }
});

// POST - Add new offline course
app.post('/api/offline-config/course', (req, res) => {
    try {
        const data = fs.readFileSync(offlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { name, category, room, price, totalSeats, duration, instructor } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Course name is required' });
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const newCourse = {
            id,
            name,
            category: category || 'General',
            room: room || 'TBD',
            price: price || 0,
            totalSeats: totalSeats || 30,
            enrolledSeats: 0,
            duration: duration || '3 Months',
            instructor: instructor || 'TBD'
        };

        config.courses.push(newCourse);
        fs.writeFileSync(offlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Course added', data: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add course' });
    }
});

// POST - Add new hybrid course
app.post('/api/hybrid-config/course', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { name, instructor, level, fee, onlinePercent, offlinePercent, startDate } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Course name is required' });
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const newCourse = {
            id,
            name,
            instructor: instructor || 'TBD',
            level: level || 'Beginner',
            levelColor: level === 'Advanced' ? 'purple' : 'green',
            startDate: startDate || 'TBD',
            onlinePercent: onlinePercent || 50,
            offlinePercent: offlinePercent || 50,
            fee: fee || 999,
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDLm39_AyR6rQo5vyxLxJv45wqd9ZwS9l5_Lb3wE4NI-S5Gipje6WYgyAG4fQXMHF3YjsnBk2gGWV_26wyJtwATnwcme11hNMVOQ-nQcx2nGfDGVwu9KNuecm09YEfczzZjIxf9AoAXGIkKCy9TJYE_lD2l8jw55EEdhQcQko_I2CJ7l4vcreo37RXUVdlVpBZGvEi9Fi0yIFxq6E41_My7B-JSbbh4OQJHln_GT-2bYbXMlF2K3jgWNCLlGjMz2OL5ajDIQuYyvCw',
            onlineSchedule: {
                days: 'TBD',
                time: 'TBD',
                description: 'Online Sessions',
                platform: 'Zoom',
                platformNote: 'Recordings available'
            },
            offlineSchedule: {
                days: 'TBD',
                time: 'TBD',
                description: 'Lab Sessions',
                location: 'TBD',
                locationNote: 'Main Campus'
            }
        };

        config.courses.push(newCourse);
        fs.writeFileSync(hybridConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Course added', data: newCourse });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add course' });
    }
});

// PUT - Update Offline Batch List (for Faculty Grid)
app.put('/api/offline-config/batches', (req, res) => {
    try {
        const data = fs.readFileSync(offlineConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { batches } = req.body;

        if (!Array.isArray(batches)) {
            return res.status(400).json({ success: false, message: 'Batches must be an array' });
        }

        config.batches = batches;
        fs.writeFileSync(offlineConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Batches updated successfully', data: config.batches });
    } catch (error) {
        console.error('Error updating offline batches:', error);
        res.status(500).json({ success: false, message: 'Failed to update batches' });
    }
});

// PUT - Update Hybrid Batch List
app.put('/api/hybrid-config/batches', (req, res) => {
    try {
        const data = fs.readFileSync(hybridConfigPath, 'utf8');
        const config = JSON.parse(data);
        const { batches } = req.body;

        if (!Array.isArray(batches)) {
            return res.status(400).json({ success: false, message: 'Batches must be an array' });
        }

        config.batches = batches;
        fs.writeFileSync(hybridConfigPath, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Batches updated successfully', data: config.batches });
    } catch (error) {
        console.error('Error updating hybrid batches:', error);
        res.status(500).json({ success: false, message: 'Failed to update batches' });
    }
});

// ========================
// STUDENT MANAGEMENT API
// ========================
const studentsDbPath = path.join(__dirname, 'students.json');

// Helper: Read students from JSON file
function readStudents() {
    try {
        if (!fs.existsSync(studentsDbPath)) {
            fs.writeFileSync(studentsDbPath, JSON.stringify({ students: [], lastUpdated: null }, null, 2));
        }
        const data = fs.readFileSync(studentsDbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading students:', error);
        return { students: [], lastUpdated: null };
    }
}

// Helper: Write students to JSON file
function writeStudents(studentsData) {
    try {
        studentsData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(studentsDbPath, JSON.stringify(studentsData, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing students:', error);
        return false;
    }
}

// GET - Retrieve all students
app.get('/api/students', (req, res) => {
    try {
        const data = readStudents();
        res.json({
            success: true,
            count: data.students.length,
            data: data.students
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve students' });
    }
});

// GET - Retrieve specific student by ID
app.get('/api/students/:id', (req, res) => {
    try {
        const data = readStudents();
        const student = data.students.find(s => s.id === req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        res.json({ success: true, data: student });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve student' });
    }
});

// POST - Create new student
app.post('/api/students', (req, res) => {
    try {
        const data = readStudents();

        // Generate smart ID: YYMM#### format
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2); // Last 2 digits of year
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Month with leading zero
        const yearMonth = year + month; // e.g., "2601" for January 2026

        // Find the highest sequence number for this year-month
        const studentsThisMonth = data.students.filter(s => s.id && s.id.startsWith(yearMonth));
        let maxSequence = 0;

        studentsThisMonth.forEach(student => {
            const sequencePart = student.id.slice(4); // Get last 4 digits
            const sequence = parseInt(sequencePart, 10);
            if (!isNaN(sequence) && sequence > maxSequence) {
                maxSequence = sequence;
            }
        });

        // Increment sequence for new student
        const newSequence = maxSequence + 1;
        const sequenceStr = String(newSequence).padStart(4, '0'); // 4 digits with leading zeros
        const studentId = yearMonth + sequenceStr; // e.g., "26010001"

        const newStudent = {
            id: studentId,
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.students.unshift(newStudent); // Add to beginning
        if (writeStudents(data)) {
            res.status(201).json({ success: true, message: 'Student created successfully', data: newStudent });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save student' });
        }
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(500).json({ success: false, message: 'Failed to create student' });
    }
});

// POST - Migrate students from localStorage to backend
app.post('/api/students/migrate', (req, res) => {
    try {
        const data = readStudents();
        const { students: incomingStudents } = req.body;

        if (!Array.isArray(incomingStudents)) {
            return res.status(400).json({ success: false, message: 'Students must be an array' });
        }

        let migratedCount = 0;

        incomingStudents.forEach(student => {
            // Check if student already exists (by email)
            const exists = data.students.find(s => s.email === student.email);
            if (!exists) {
                // Generate ID based on student's timestamp or current date
                const studentDate = student.timestamp ? new Date(student.timestamp) : new Date();
                const year = String(studentDate.getFullYear()).slice(-2);
                const month = String(studentDate.getMonth() + 1).padStart(2, '0');
                const yearMonth = year + month;

                // Find sequence for this student's month
                const studentsThisMonth = data.students.filter(s => s.id && s.id.startsWith(yearMonth));
                let maxSequence = 0;
                studentsThisMonth.forEach(s => {
                    const seq = parseInt(s.id.slice(4), 10);
                    if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
                });

                const newSequence = maxSequence + 1;
                const studentId = yearMonth + String(newSequence).padStart(4, '0');

                data.students.push({
                    id: studentId,
                    ...student,
                    createdAt: student.timestamp || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                migratedCount++;
            }
        });

        if (writeStudents(data)) {
            res.json({
                success: true,
                message: `Migrated ${migratedCount} students successfully`,
                migratedCount,
                totalStudents: data.students.length
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save migrated students' });
        }
    } catch (error) {
        console.error('Error migrating students:', error);
        res.status(500).json({ success: false, message: 'Failed to migrate students' });
    }
});

// PUT - Update student
app.put('/api/students/:id', (req, res) => {
    try {
        const data = readStudents();
        const index = data.students.findIndex(s => s.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        data.students[index] = {
            ...data.students[index],
            ...req.body,
            id: req.params.id, // Preserve ID
            updatedAt: new Date().toISOString()
        };
        if (writeStudents(data)) {
            res.json({ success: true, message: 'Student updated successfully', data: data.students[index] });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update student' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update student' });
    }
});

// DELETE - Remove student
app.delete('/api/students/:id', (req, res) => {
    try {
        const data = readStudents();
        const index = data.students.findIndex(s => s.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        const deleted = data.students.splice(index, 1)[0];
        if (writeStudents(data)) {
            res.json({ success: true, message: 'Student deleted successfully', data: deleted });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete student' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete student' });
    }
});

// GET - Dashboard statistics
app.get('/api/students/stats/dashboard', (req, res) => {
    try {
        const data = readStudents();
        const students = data.students;

        // Calculate statistics
        const totalStudents = students.length;
        const uniqueCourses = new Set(students.map(s => s.desiredCourse).filter(c => c));
        const activeCourses = uniqueCourses.size;

        // Calculate average completion (mock based on enrollment)
        const baseCompletion = 68;
        const variance = totalStudents > 0 ? Math.min(Math.floor(totalStudents / 20), 7) : 0;
        const avgCompletion = Math.min(baseCompletion + variance, 85);

        // Calculate course rating
        const baseRating = 4.6;
        const ratingBoost = totalStudents > 0 ? Math.min(totalStudents / 1000, 0.3) : 0;
        const courseRating = Math.min(baseRating + ratingBoost, 5.0);

        // Reviews count
        const reviewCount = Math.floor(totalStudents * 0.27);

        res.json({
            success: true,
            data: {
                totalStudents,
                activeCourses,
                avgCompletion,
                courseRating: parseFloat(courseRating.toFixed(1)),
                reviewCount,
                trendPercent: totalStudents > 0 ? Math.min(Math.round((totalStudents / 100) * 12), 25) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to calculate statistics' });
    }
});

// ========================
// ADMIN & SUPER ADMIN MANAGEMENT API
// ========================
const adminsDbPath = path.join(__dirname, 'admins.json');

function readAdmins() {
    try {
        if (!fs.existsSync(adminsDbPath)) {
            const defaultData = {
                admins: [{ id: "ADM-1", name: "Admin", email: "jyotiprithvisambha2116@gmail.com", password: "2116", role: "Admin", status: "Active" }],
                superAdmins: [{ id: "SAD-1", name: "Super Admin", email: "superadmin@techproai.com", password: "admin", role: "SuperAdmin", status: "Active" }],
                lastUpdated: null
            };
            fs.writeFileSync(adminsDbPath, JSON.stringify(defaultData, null, 2));
        }
        return JSON.parse(fs.readFileSync(adminsDbPath, 'utf8'));
    } catch (error) {
        console.error('Error reading admins:', error);
        return { admins: [], superAdmins: [], lastUpdated: null };
    }
}

function writeAdmins(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(adminsDbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing admins:', error);
        return false;
    }
}

// POST - Admin Login
app.post('/api/admins/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const data = readAdmins();
        const admin = data.admins.find(a => a.email === email && a.status === 'Active');

        if (!admin || admin.password !== password) {
            return res.status(401).json({ success: false, message: 'INVALID_CREDENTIALS' });
        }

        sendLoginSuccessEmail(admin.email, admin.name, "Admin", "/A9Admin.html");

        res.json({ success: true, message: 'LOGIN_SUCCESS', admin: { id: admin.id, name: admin.name, email: admin.email } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// POST - Super Admin Login
app.post('/api/super-admins/login', (req, res) => {
    try {
        const { identifier, password } = req.body;
        const data = readAdmins();
        // identifier can be email or name/id
        const superAdmin = data.superAdmins.find(s => (s.email === identifier || s.id === identifier) && s.status === 'Active');

        if (!superAdmin || superAdmin.password !== password) {
            return res.status(401).json({ success: false, message: 'INVALID_CREDENTIALS' });
        }

        sendLoginSuccessEmail(superAdmin.email, superAdmin.name, "Super Admin", "/A15Dashboard.html");

        res.json({ success: true, message: 'LOGIN_SUCCESS', superAdmin: { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// ========================
// TRAINER MANAGEMENT API
// ========================
const trainersDbPath = path.join(__dirname, 'trainers.json');

// Helper: Read trainers from JSON file
function readTrainers() {
    try {
        if (!fs.existsSync(trainersDbPath)) {
            fs.writeFileSync(trainersDbPath, JSON.stringify({ trainers: [], lastUpdated: null }, null, 2));
        }
        const data = fs.readFileSync(trainersDbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading trainers:', error);
        return { trainers: [], lastUpdated: null };
    }
}

// Helper: Write trainers to JSON file
function writeTrainers(trainersData) {
    try {
        trainersData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(trainersDbPath, JSON.stringify(trainersData, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing trainers:', error);
        return false;
    }
}

// GET - Retrieve all trainers
app.get('/api/trainers', (req, res) => {
    try {
        const data = readTrainers();
        res.json({
            success: true,
            count: data.trainers.length,
            data: data.trainers
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve trainers' });
    }
});

// POST - Create or Update trainer (Update if ID exists)
app.post('/api/trainers', (req, res) => {
    try {
        const data = readTrainers();
        const { id, name, email, password, specialization, experience, status } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (id) {
            // Update existing trainer
            const index = data.trainers.findIndex(t => t.id === id);
            if (index !== -1) {
                data.trainers[index] = {
                    ...data.trainers[index],
                    name,
                    email,
                    password,
                    specialization: specialization || 'General',
                    experience: experience || '0',
                    status: status || 'Active',
                    updatedAt: new Date().toISOString()
                };
                if (writeTrainers(data)) {
                    return res.json({ success: true, message: 'Trainer updated successfully', data: data.trainers[index] });
                }
            } else {
                return res.status(404).json({ success: false, message: 'Trainer with specified ID not found' });
            }
        } else {
            // Check if email already used (for new trainers)
            if (data.trainers.find(t => t.email === email)) {
                return res.status(400).json({ success: false, message: 'Trainer with this email already exists' });
            }

            // Create new trainer
            const newId = `TRN-${Date.now()}`;
            const newTrainer = {
                id: newId,
                name,
                email,
                password,
                specialization: specialization || 'General',
                experience: experience || '0',
                status: status || 'Active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            data.trainers.unshift(newTrainer);
            if (writeTrainers(data)) {
                res.status(201).json({ success: true, message: 'Trainer added successfully', data: newTrainer });
            } else {
                res.status(500).json({ success: false, message: 'Failed to save trainer' });
            }
        }
    } catch (error) {
        console.error('Error managing trainer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Trainer Login
app.post('/api/trainers/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const data = readTrainers();
        const trainer = data.trainers.find(t => t.email === email && t.status === 'Active');

        if (!trainer || trainer.password !== password) {
            return res.status(401).json({ success: false, message: 'INVALID_CREDENTIALS' });
        }

        // Login successful
        sendLoginSuccessEmail(trainer.email, trainer.name, "Trainer", "/Faculty.html");

        res.json({
            success: true,
            message: 'LOGIN_SUCCESS',
            trainer: { id: trainer.id, name: trainer.name, email: trainer.email }
        });
    } catch (error) {
        console.error('Trainer login error:', error);
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// DELETE - Remove trainer
app.delete('/api/trainers/:id', (req, res) => {
    try {
        const data = readTrainers();
        const index = data.trainers.findIndex(t => t.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Trainer not found' });
        }

        const deleted = data.trainers.splice(index, 1)[0];
        if (writeTrainers(data)) {
            res.json({ success: true, message: 'Trainer removed successfully', data: deleted });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete trainer' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========================
// USER AUTHENTICATION API WITH EMAIL VERIFICATION
// ========================

const usersDbPath = path.join(__dirname, 'users.json');

// Helper: Read users from JSON file
function readUsers() {
    try {
        if (!fs.existsSync(usersDbPath)) {
            fs.writeFileSync(usersDbPath, JSON.stringify({ users: [], lastUpdated: null }, null, 2));
        }
        const data = fs.readFileSync(usersDbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return { users: [], lastUpdated: null };
    }
}

// Helper: Write users to JSON file
function writeUsers(usersData) {
    try {
        usersData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(usersDbPath, JSON.stringify(usersData, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing users:', error);
        return false;
    }
}



// Helper: Generate verification token
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Helper: Send verification email
async function sendVerificationEmail(email, firstName, verificationToken) {
    if (!transporter) {
        console.warn('⚠️  Email service not configured. Skipping email send.');
        return false;
    }

    const verificationLink = `${emailConfig.appUrl}/A3Login.html?verified=true&email=${encodeURIComponent(email)}`;

    const mailOptions = {
        from: `"${emailConfig.email.from.name}" <${emailConfig.email.from.address}>`,
        to: email,
        subject: '🎓 Welcome to TECH-PRO AI - Verify Your Email',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 40px 30px; text-align: center;">
                            <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 20px; display: inline-block;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: -0.5px;">
                                    🚀 TECH-PRO AI
                                </h1>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 28px; font-weight: 700;">
                                Welcome, ${firstName}! 👋
                            </h2>
                            <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.6;">
                                Thank you for joining <strong>TECH-PRO AI</strong>, your gateway to cutting-edge technology education powered by artificial intelligence.
                            </p>
                            <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.6;">
                                Your account has been successfully created! You can now log in and start your learning journey.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${verificationLink}" style="display: inline-block; padding: 16px 36px; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); transition: all 0.3s;">
                                            ✨ Login to Your Account
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Info Box -->
                            <div style="background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
                                <p style="margin: 0 0 10px; color: #1e40af; font-weight: 700; font-size: 14px;">
                                    📧 Your Account Details
                                </p>
                                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                                    <strong>Email:</strong> ${email}<br>
                                    <strong>Registration Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            
                            <!-- What's Next -->
                            <div style="margin: 30px 0;">
                                <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 700;">
                                    🎯 What's Next?
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                                    <li>Complete your profile to personalize your experience</li>
                                    <li>Take our AI-powered skill assessment (5 minutes)</li>
                                    <li>Get a customized learning path based on your goals</li>
                                    <li>Start learning with our expert instructors</li>
                                </ul>
                            </div>
                            
                            <p style="margin: 30px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                If you didn't create this account, please ignore this email or contact our support team.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 15px; color: #64748b; font-size: 13px; text-align: center;">
                                Need help? Contact us at <a href="mailto:support@techproai.com" style="color: #3b82f6; text-decoration: none; font-weight: 600;">support@techproai.com</a>
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                © ${new Date().getFullYear()} TECH-PRO AI Inc. All rights reserved.<br>
                                Empowering the next generation of tech professionals.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to: ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification email:', error.message);
        return false;
    }
}

// Helper: Send login success email
async function sendLoginSuccessEmail(email, firstName, role = "Student", dashboardUrl = "/A5Dashboard.html") {
    if (!transporter) {
        console.warn('⚠️  Email service not configured. Skipping email send.');
        return false;
    }

    const loginTime = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
    });

    const mailOptions = {
        from: `"${emailConfig.email.from.name}" <${emailConfig.email.from.address}>`,
        to: email,
        subject: `✅ Successful Login to TECH-PRO AI (${role} Portal)`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <!-- Header Section -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
                            <div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2;">
                                ${role} Login Successful
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content Section -->
                    <tr>
                        <td style="padding: 40px 30px; background-color: #ffffff;">
                            <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                                Hello ${firstName},
                            </p>
                            <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.6;">
                                This is to confirm that you have successfully accessed the <strong>${role} Portal</strong> on TECH-PRO AI.
                            </p>
                            
                            <!-- Login Details Box -->
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 25px; border-radius: 12px; margin: 30px 0;">
                                <p style="margin: 0 0 15px; color: #065f46; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                                    🔐 Login Details
                                </p>
                                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                                    <strong>Role:</strong> ${role}<br>
                                    <strong>Email:</strong> ${email}<br>
                                    <strong>Login Time:</strong> ${loginTime}<br>
                                    <strong>Status:</strong> <span style="color: #10b981; font-weight: 700;">✓ Verified Access</span>
                                </p>
                            </div>
                            
                            <!-- Security Notice -->
                            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0;">
                                <p style="margin: 0 0 10px; color: #92400e; font-weight: 700; font-size: 14px;">
                                    🔒 Security Notice
                                </p>
                                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                                    If you did not perform this login, please contact the system administrator immediately.
                                </p>
                            </div>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${emailConfig.appUrl}${dashboardUrl}" style="display: inline-block; padding: 16px 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
                                            🖥️ Go to Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                Welcome back to the TECH-PRO AI management suite.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 15px; color: #64748b; font-size: 13px; text-align: center;">
                                Need help? Contact us at <a href="mailto:support@techproai.com" style="color: #10b981; text-decoration: none; font-weight: 600;">support@techproai.com</a>
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                © ${new Date().getFullYear()} TECH-PRO AI Inc. All rights reserved.<br>
                                This is an automated security notification. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Login success email sent to: ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send login success email:', error.message);
        return false;
    }
}

// Helper: Send password reset email
async function sendPasswordResetEmail(email, firstName, resetToken) {
    const appUrl = (emailConfig && emailConfig.appUrl) ? emailConfig.appUrl : 'http://localhost:8080';
    const resetLink = `${appUrl}/ResetPassword.html?token=${resetToken}`;

    // DEV LOGGING (Vital for testing without SMTP)
    console.log(`\n🔗 [DEV PREVIEW] Password Reset Link for ${email}:\n${resetLink}\n`);

    if (!transporter) {
        console.warn('⚠️  Email service not configured. Skipping email send (Use Dev Link above).');
        return true; // Return TRUE so frontend flow continues
    }

    const mailOptions = {
        from: `"${emailConfig.email.from.name}" <${emailConfig.email.from.address}>`,
        to: email,
        subject: '🔒 Reset Your TECH-PRO AI Password',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 20px;">🔑</div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                                Password Reset Request
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                                Hello ${firstName},
                            </p>
                            <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.6;">
                                We received a request to reset the password for your TECH-PRO AI account.
                            </p>
                            <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.6;">
                                To reset your password, click the button below. This link acts as a secure key and will expire in 1 hour.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${resetLink}" style="display: inline-block; padding: 16px 36px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                © ${new Date().getFullYear()} TECH-PRO AI Inc. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to: ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send reset email:', error.message);
        return false;
    }
}

// POST - User Signup with Email Verification
app.post('/api/users/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).send('MISSING_FIELDS');
        }

        // Detect if input is email or phone number
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;

        let identifierType = '';
        let normalizedIdentifier = email.trim();

        if (emailRegex.test(normalizedIdentifier)) {
            identifierType = 'email';
        } else if (phoneRegex.test(normalizedIdentifier.replace(/\s+/g, ''))) {
            identifierType = 'phone';
            // Normalize phone number (remove spaces, ensure +91 prefix)
            normalizedIdentifier = normalizedIdentifier.replace(/\s+/g, '');
            if (!normalizedIdentifier.startsWith('+')) {
                if (normalizedIdentifier.startsWith('91')) {
                    normalizedIdentifier = '+' + normalizedIdentifier;
                } else {
                    normalizedIdentifier = '+91' + normalizedIdentifier;
                }
            }
        } else {
            return res.status(400).text('INVALID_EMAIL');
        }

        const data = readUsers();

        // Check if user already exists
        const existingUser = data.users.find(u => u.email === normalizedIdentifier);
        if (existingUser) {
            return res.status(400).send('ALREADY_REGISTERED');
        }

        // Generate verification token
        const verificationToken = generateVerificationToken();

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            firstName,
            lastName,
            email: normalizedIdentifier,
            identifierType, // 'email' or 'phone'
            password, // In production, this should be hashed!
            verificationToken,
            isVerified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.users.push(newUser);

        if (writeUsers(data)) {
            console.log(`✅ New user registered: ${normalizedIdentifier} (${identifierType})`);

            // Send verification email ONLY if identifier is email
            if (identifierType === 'email') {
                const emailSent = await sendVerificationEmail(normalizedIdentifier, firstName, verificationToken);

                if (emailSent) {
                    res.status(201).send('SIGNUP_SUCCESS_EMAIL_SENT');
                } else {
                    res.status(201).send('SIGNUP_SUCCESS');
                }
            } else {
                // Phone number registration - no email sent
                console.log(`📱 Phone registration - no email sent`);
                res.status(201).send('SIGNUP_SUCCESS');
            }
        } else {
            res.status(500).send('SERVER_ERROR');
        }
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).send('SERVER_ERROR');
    }
});

// GET - Verify Email (optional endpoint if you want to verify via link click)
app.get('/api/users/verify/:token', (req, res) => {
    try {
        const { token } = req.params;
        const data = readUsers();

        const user = data.users.find(u => u.verificationToken === token);

        if (!user) {
            return res.status(404).send('Invalid verification token');
        }

        if (user.isVerified) {
            return res.send('Email already verified. You can now log in.');
        }

        // Mark user as verified
        user.isVerified = true;
        user.verificationToken = null;
        user.verifiedAt = new Date().toISOString();

        if (writeUsers(data)) {
            console.log(`✅ User verified: ${user.email}`);
            // Redirect to login page
            res.redirect('/A3Login.html?verified=true');
        } else {
            res.status(500).send('Failed to verify email');
        }
    } catch (error) {
        console.error('Error in email verification:', error);
        res.status(500).send('Server error');
    }
});

// POST - User Login
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).send('MISSING_FIELDS');
        }

        // Detect if input is email or phone number and normalize
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;

        let normalizedIdentifier = email.trim();
        let isEmail = false;

        if (emailRegex.test(normalizedIdentifier)) {
            isEmail = true;
        } else if (phoneRegex.test(normalizedIdentifier.replace(/\s+/g, ''))) {
            // Normalize phone number
            normalizedIdentifier = normalizedIdentifier.replace(/\s+/g, '');
            if (!normalizedIdentifier.startsWith('+')) {
                if (normalizedIdentifier.startsWith('91')) {
                    normalizedIdentifier = '+' + normalizedIdentifier;
                } else {
                    normalizedIdentifier = '+91' + normalizedIdentifier;
                }
            }
        } else {
            return res.status(400).send('INVALID_EMAIL');
        }

        const data = readUsers();

        // Find user by normalized identifier
        const user = data.users.find(u => u.email === normalizedIdentifier);

        if (!user) {
            return res.status(401).send('INVALID_CREDENTIALS');
        }

        // Check password
        if (user.password !== password) {
            return res.status(401).send('INVALID_CREDENTIALS');
        }

        // Login successful
        console.log(`✅ User logged in: ${normalizedIdentifier} (${user.identifierType || 'email'})`);

        // Send login success email ONLY if user registered with email
        if (user.identifierType === 'email' || !user.identifierType) {
            // Send email (don't wait for it to complete)
            sendLoginSuccessEmail(normalizedIdentifier, user.firstName).catch(err => {
                console.error('Error sending login email:', err);
            });
        } else {
            console.log(`📱 Phone login - no email sent`);
        }

        res.status(200).send('LOGIN_SUCCESS');
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).send('SERVER_ERROR');
    }
});

// POST - Forgot Password
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const data = readUsers();
        const user = data.users.find(u => u.email === email);

        if (!user) {
            // Security: Don't reveal if user exists or not, but for this demo request we will return success even if not found, or maybe just generic message. 
            // However, the user request specifically asked "sent to the specific email".
            // Let's return success but log it.
            return res.status(404).json({ success: false, message: 'User with this email does not exist.' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = Date.now() + 3600000; // 1 hour

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpires;

        if (writeUsers(data)) {
            const resetLink = `${emailConfig.appUrl}/ResetPassword.html?token=${resetToken}`;

            const mailOptions = {
                from: emailConfig.email.from,
                to: email,
                subject: '🔒 Reset Your Password - TECH-PRO AI',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4f46e5;">Password Reset Request</h2>
                        <p>Hello ${user.firstName},</p>
                        <p>You requested a password reset for your TECH-PRO AI account.</p>
                        <p>Click the button below to reset your password. This link is valid for 1 hour.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="color: #6b7280; font-size: 14px;">${resetLink}</p>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px;">If you didn't ask to reset your password, you can ignore this email.</p>
                    </div>
                `
            };

            if (transporter) {
                transporter.sendMail(mailOptions);
                console.log(`✅ Reset password email sent to: ${email}`);
                res.json({ success: true, message: 'Password reset link sent to your email.' });
            } else {
                console.warn('⚠️ Email service not configured. Returning mock success.');
                // For development without email, maybe log the link?
                console.log(`[DEV] Reset Link: ${resetLink}`);
                res.json({ success: true, message: 'Email service not configured (Check console for link).' });
            }
        } else {
            res.status(500).json({ success: false, message: 'Failed to save reset token.' });
        }
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Reset Password
app.post('/api/reset-password', (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Token and new password are required' });
        }

        const data = readUsers();
        const user = data.users.find(u =>
            u.resetPasswordToken === token &&
            u.resetPasswordExpires > Date.now()
        );

        if (!user) {
            return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
        }

        // Update password
        user.password = newPassword; // In production this should be hashed
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.updatedAt = new Date().toISOString();

        if (writeUsers(data)) {
            console.log(`✅ Password reset for user: ${user.email}`);
            res.json({ success: true, message: 'Password has been reset successfully.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update password.' });
        }

    } catch (error) {
        console.error('Error in reset password:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET - Retrieve all users (for admin purposes)
app.get('/api/users', (req, res) => {
    try {
        const data = readUsers();
        // Don't send passwords in response
        const usersWithoutPasswords = data.users.map(({ password, ...user }) => user);
        res.json({
            success: true,
            count: data.users.length,
            data: usersWithoutPasswords
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve users' });
    }
});

// ========================
// BATCH REQUEST MANAGEMENT API
// ========================
// Config path defined globally

// Helper: Read batch requests
function readBatchRequests() {
    try {
        if (!fs.existsSync(batchRequestsPath)) {
            fs.writeFileSync(batchRequestsPath, JSON.stringify({ requests: [], lastUpdated: null }, null, 2));
        }
        const data = fs.readFileSync(batchRequestsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading batch requests:', error);
        return { requests: [], lastUpdated: null };
    }
}

// Helper: Write batch requests
function writeBatchRequests(requestsData) {
    try {
        requestsData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(batchRequestsPath, JSON.stringify(requestsData, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing batch requests:', error);
        return false;
    }
}

// POST - Create new batch request
app.post('/api/batch-requests', (req, res) => {
    try {
        const data = readBatchRequests();
        const { studentName, email, phone, courseTrack, preferredTime, batchSize, additionalNotes } = req.body;

        if (!studentName || !email || !courseTrack) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const requestId = `req-${Date.now()}`;
        const newRequest = {
            id: requestId,
            studentName,
            email,
            phone,
            courseTrack,
            preferredTime,
            batchSize,
            additionalNotes,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.requests.unshift(newRequest);

        if (writeBatchRequests(data)) {
            res.status(201).json({
                success: true,
                message: 'Batch request submitted successfully',
                data: newRequest
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save request' });
        }
    } catch (error) {
        console.error('Error creating batch request:', error);
        res.status(500).json({ success: false, message: 'Failed to create batch request' });
    }
});

// GET - Retrieve all batch requests
app.get('/api/batch-requests', (req, res) => {
    try {
        const data = readBatchRequests();
        res.json({
            success: true,
            count: data.requests.length,
            data: data.requests
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve batch requests' });
    }
});

// GET - Retrieve specific batch request
app.get('/api/batch-requests/:id', (req, res) => {
    try {
        const data = readBatchRequests();
        const request = data.requests.find(r => r.id === req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve request' });
    }
});

// PUT - Approve batch request
app.put('/api/batch-requests/:id/approve', async (req, res) => {
    try {
        const data = readBatchRequests();
        const index = data.requests.findIndex(r => r.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const request = data.requests[index];
        request.status = 'approved';
        request.updatedAt = new Date().toISOString();
        request.approvedAt = new Date().toISOString();

        if (writeBatchRequests(data)) {
            // Send approval email
            if (transporter && request.email) {
                try {
                    await transporter.sendMail({
                        from: emailConfig.email,
                        to: request.email,
                        subject: '✅ Your Custom Batch Request Has Been Approved!',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #137fec;">Batch Request Approved!</h2>
                                <p>Dear ${request.studentName},</p>
                                <p>Great news! Your custom batch request has been approved.</p>
                                <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="margin-top: 0;">Request Details:</h3>
                                    <p><strong>Course:</strong> ${request.courseTrack}</p>
                                    <p><strong>Preferred Time:</strong> ${request.preferredTime}</p>
                                    <p><strong>Batch Size:</strong> ${request.batchSize}</p>
                                    ${request.additionalNotes ? `<p><strong>Notes:</strong> ${request.additionalNotes}</p>` : ''}
                                </div>
                                <p>Our team will contact you shortly at <strong>${request.phone}</strong> to finalize the batch schedule and enrollment details.</p>
                                <p>Thank you for choosing AI-TECH PRO!</p>
                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                                <p style="color: #6b7280; font-size: 12px;">This is an automated email from AI-TECH PRO. Please do not reply to this email.</p>
                            </div>
                        `
                    });
                    console.log(`✅ Approval email sent to ${request.email}`);
                } catch (emailError) {
                    console.error('Error sending approval email:', emailError);
                }
            }

            res.json({
                success: true,
                message: 'Request approved and email sent',
                data: request
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update request' });
        }
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ success: false, message: 'Failed to approve request' });
    }
});

// ========================
// ENROLLMENT ROUTES
// ========================
const enrollmentsPath = path.join(__dirname, 'enrollments.json');

// Helper: Read enrollments
function readEnrollments() {
    try {
        if (!fs.existsSync(enrollmentsPath)) {
            // Create default file if not exists
            const defaultData = { enrollments: [] };
            fs.writeFileSync(enrollmentsPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(enrollmentsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading enrollments:', error);
        return { enrollments: [] };
    }
}

// Helper: Write enrollments
function writeEnrollments(data) {
    try {
        fs.writeFileSync(enrollmentsPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing enrollments:', error);
        return false;
    }
}

// GET - Retrieve all enrollments
app.get('/api/enrollments', (req, res) => {
    try {
        const data = readEnrollments();
        res.json({ success: true, count: data.enrollments.length, data: data.enrollments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch enrollments' });
    }
});

// GET - Retrieve enrollments by type
app.get('/api/enrollments/:type', (req, res) => {
    try {
        const { type } = req.params;
        const data = readEnrollments();
        const filtered = data.enrollments.filter(e => e.type === type);
        res.json({ success: true, count: filtered.length, enrollments: filtered });
    } catch (error) {
        console.error('Error fetching enrollments by type:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch enrollments' });
    }
});

// POST - Create new enrollment
app.post('/api/enrollments', (req, res) => {
    try {
        const { type, studentName, email, phone, course, batchDetails } = req.body;

        if (!studentName || !email || !course) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const data = readEnrollments();

        const newEnrollment = {
            id: `ENR-${Date.now()}`,
            type: type || 'online',
            studentName,
            email,
            phone: phone || '',
            course,
            batchDetails: batchDetails || {},
            status: 'Pending',
            enrolledAt: new Date().toISOString()
        };

        if (!data.enrollments) data.enrollments = [];
        data.enrollments.unshift(newEnrollment);

        if (writeEnrollments(data)) {
            // Send confirmation email
            if (transporter) {
                transporter.sendMail({
                    from: emailConfig.email,
                    to: email,
                    subject: '🎉 Enrollment Received - AI-TECH PRO',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #137fec;">Enrollment Confirmation</h2>
                            <p>Hi ${studentName},</p>
                            <p>We have received your enrollment request for <strong>${course}</strong>.</p>
                            <p>Our team will review your details and contact you shortly.</p>
                            <p>Status: <strong>Pending Approval</strong></p>
                        </div>
                    `
                }).catch(err => console.error('Email error:', err));
            }

            res.status(201).json({ success: true, message: 'Enrollment submitted successfully', data: newEnrollment });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save enrollment' });
        }
    } catch (error) {
        console.error('Error creating enrollment:', error);
        res.status(500).json({ success: false, message: 'Enrollment creation failed' });
    }
});

// PUT - Approve enrollment
app.put('/api/enrollments/:id/approve', (req, res) => {
    try {
        const { id } = req.params;
        const data = readEnrollments();
        const enrollment = data.enrollments.find(e => e.id === id);

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        }

        enrollment.status = 'Approved';
        enrollment.approvedAt = new Date().toISOString();

        if (writeEnrollments(data)) {
            res.json({ success: true, message: 'Enrollment approved', data: enrollment });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save approval' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Approval failed' });
    }
});

// PUT - Reject enrollment
app.put('/api/enrollments/:id/reject', (req, res) => {
    try {
        const { id } = req.params;
        const data = readEnrollments();
        const enrollment = data.enrollments.find(e => e.id === id);

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        }

        enrollment.status = 'Rejected';
        enrollment.rejectedAt = new Date().toISOString();

        if (writeEnrollments(data)) {
            res.json({ success: true, message: 'Enrollment rejected', data: enrollment });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save rejection' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Rejection failed' });
    }
});


// PUT - Reject batch request
app.put('/api/batch-requests/:id/reject', async (req, res) => {
    try {
        const data = readBatchRequests();
        const index = data.requests.findIndex(r => r.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const request = data.requests[index];
        const { reason } = req.body;

        request.status = 'rejected';
        request.updatedAt = new Date().toISOString();
        request.rejectedAt = new Date().toISOString();
        request.rejectionReason = reason || 'Not specified';

        if (writeBatchRequests(data)) {
            // Send rejection email
            if (transporter && request.email) {
                try {
                    await transporter.sendMail({
                        from: emailConfig.email,
                        to: request.email,
                        subject: 'Update on Your Custom Batch Request',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #ef4444;">Batch Request Update</h2>
                                <p>Dear ${request.studentName},</p>
                                <p>Thank you for your interest in AI-TECH PRO. Unfortunately, we are unable to accommodate your custom batch request at this time.</p>
                                <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="margin-top: 0;">Request Details:</h3>
                                    <p><strong>Course:</strong> ${request.courseTrack}</p>
                                    <p><strong>Preferred Time:</strong> ${request.preferredTime}</p>
                                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                                </div>
                                <p>However, we have many other batch options available! Please check our regular batch schedule or contact us to explore alternative options.</p>
                                <p>We appreciate your understanding and hope to serve you in the future.</p>
                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                                <p style="color: #6b7280; font-size: 12px;">This is an automated email from AI-TECH PRO. Please do not reply to this email.</p>
                            </div>
                        `
                    });
                    console.log(`✅ Rejection email sent to ${request.email}`);
                } catch (emailError) {
                    console.error('Error sending rejection email:', emailError);
                }
            }

            res.json({
                success: true,
                message: 'Request rejected and email sent',
                data: request
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update request' });
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ success: false, message: 'Failed to reject request' });
    }
});

// DELETE - Delete batch request
app.delete('/api/batch-requests/:id', (req, res) => {
    try {
        const data = readBatchRequests();
        const index = data.requests.findIndex(r => r.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const deleted = data.requests.splice(index, 1)[0];

        if (writeBatchRequests(data)) {
            res.json({ success: true, message: 'Request deleted successfully', data: deleted });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete request' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete request' });
    }
});

// ========================
// PRICING PLANS API
// ========================
const pricingPlansPath = path.join(__dirname, 'pricing-plans.json');

// Helper: Read pricing plans
function readPricingPlans() {
    try {
        if (!fs.existsSync(pricingPlansPath)) {
            const defaultPlans = {
                plans: [
                    {
                        planName: "Basic Plan",
                        monthlyPrice: "0.00",
                        durationCycle: "Lifetime",
                        allowUpgrades: true,
                        freeTrial: false,
                        trialDays: 0,
                        autoRenew: false,
                        prioritySupport: false,
                        contactSales: false
                    },
                    {
                        planName: "Pro Plan",
                        monthlyPrice: "29.00",
                        durationCycle: "Monthly",
                        allowUpgrades: false,
                        freeTrial: true,
                        trialDays: 14,
                        autoRenew: true,
                        prioritySupport: false,
                        contactSales: false
                    },
                    {
                        planName: "Enterprise",
                        monthlyPrice: "99.00",
                        durationCycle: "Annual",
                        allowUpgrades: false,
                        freeTrial: false,
                        trialDays: 0,
                        autoRenew: false,
                        prioritySupport: true,
                        contactSales: false
                    }
                ],
                lastUpdated: null
            };
            fs.writeFileSync(pricingPlansPath, JSON.stringify(defaultPlans, null, 2));
        }
        const data = fs.readFileSync(pricingPlansPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading pricing plans:', error);
        return { plans: [], lastUpdated: null };
    }
}

// Helper: Write pricing plans
function writePricingPlans(plansData) {
    try {
        plansData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(pricingPlansPath, JSON.stringify(plansData, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing pricing plans:', error);
        return false;
    }
}

// GET - Retrieve all pricing plans
app.get('/api/pricing', (req, res) => {
    try {
        const data = readPricingPlans();
        res.json(data.plans);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve pricing plans' });
    }
});

// POST - Save/Update pricing plan
app.post('/api/pricing/save', (req, res) => {
    try {
        const data = readPricingPlans();
        const { planName, monthlyPrice, durationCycle, allowUpgrades, freeTrial, trialDays, autoRenew, prioritySupport, contactSales } = req.body;

        if (!planName) {
            return res.status(400).json({ success: false, message: 'Plan name is required' });
        }

        // Find existing plan or create new one
        const planIndex = data.plans.findIndex(p => p.planName === planName);

        const updatedPlan = {
            planName,
            monthlyPrice: monthlyPrice || "0.00",
            durationCycle: durationCycle || "Monthly",
            allowUpgrades: allowUpgrades || false,
            freeTrial: freeTrial || false,
            trialDays: trialDays || 0,
            autoRenew: autoRenew || false,
            prioritySupport: prioritySupport || false,
            contactSales: contactSales || false
        };

        if (planIndex !== -1) {
            // Update existing plan
            data.plans[planIndex] = updatedPlan;
        } else {
            // Add new plan
            data.plans.push(updatedPlan);
        }

        if (writePricingPlans(data)) {
            res.json({ success: true, message: 'Pricing plan saved successfully', data: updatedPlan });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save pricing plan' });
        }
    } catch (error) {
        console.error('Error saving pricing plan:', error);
        res.status(500).json({ success: false, message: 'Failed to save pricing plan' });
    }
});

// ========================
// AICC COURSE MANAGEMENT API
// ========================
const multer = require('multer');
const aiccCoursePath = path.join(__dirname, 'aicc-course.json');
const uploadsDir = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|webm|avi|mov|mkv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'));
        }
    }
});

// Helper: Read AiCC course data
function readAiccCourse() {
    try {
        if (!fs.existsSync(aiccCoursePath)) {
            const defaultData = {
                courseInfo: {
                    courseTitle: "Cloud Computing",
                    currentTopic: "Virtualization",
                    tutorName: "Sarah (AI Tutor)",
                    tutorAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBm97sI5Wu9X-H9bNTD_7zKgD2N8D3OfhjP9F9sotk29A7R7gC4nu061bPzIv_-u10hRC8XTK0_eSfIRCVEzFXCqHfn7m7GajQzUHH3QAyt4NVTd6mT7OzD58bDwqnkiAp1-Xyhc39SJC025sbZTeziXBRXUPL2UmtqP6wobbcNj745Wg_Maan7CFvuoQOwpdo20Nxipjp7EAnUi9XqrBhvVBVIrdWYj4VVx2nr0i5d2kalhMMQsBo5FOmOW0gtSMdbwHdYXNmzrxKn",
                    aiMessage: "Serverless computing allows you to build and run applications without managing infrastructure.",
                    videoDuration: "12:45",
                    timeRemaining: "14 mins remaining"
                },
                videoInfo: {
                    youtubeId: "s_qQfOitQIs",
                    backgroundImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuBfp4ylADa58d_Dh-XYy3TCjyhn0H23sLmDA39CvpCb2xc-aaKN85KmOKKvOcvhiUSCsDSZDFErOT8axsCcuCNe12FXQoIDajzNuhuFdEWcnw2qYT3vrlOFVpT04zlr6bE5mqV_jrZa0NB4es4wbYR9oZYgBwQW2R1mVEBzDhTTw4CD-_aO_7aIJb3Wi6b7aKBzkobJoUqvtiSvRJYE48jkULEOOx0bKy8pITq95RvFGxZVoJLoow0RrJcPs35aOM0-482thXbOqObE",
                    uploadedVideo: null
                },
                modules: [
                    { id: 1, name: "1. Introduction", status: "completed", locked: false },
                    { id: 2, name: "2. Virtualization", status: "active", locked: false },
                    { id: 3, name: "3. Containers & K8s", status: "locked", locked: true },
                    { id: 4, name: "4. Serverless Arch", status: "locked", locked: true },
                    { id: 5, name: "5. Cloud Security", status: "locked", locked: true }
                ],
                lastUpdated: null
            };
            fs.writeFileSync(aiccCoursePath, JSON.stringify(defaultData, null, 2));
        }
        const data = fs.readFileSync(aiccCoursePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading AiCC course data:', error);
        return null;
    }
}

// Helper: Write AiCC course data
function writeAiccCourse(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(aiccCoursePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing AiCC course data:', error);
        return false;
    }
}

// GET - Retrieve course info
app.get('/api/aicc-course/course-info', (req, res) => {
    try {
        const data = readAiccCourse();
        if (data) {
            res.json({ success: true, data: data.courseInfo });
        } else {
            res.status(500).json({ success: false, message: 'Failed to read course info' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Update course info
app.post('/api/aicc-course/course-info', (req, res) => {
    try {
        const data = readAiccCourse();
        if (!data) {
            return res.status(500).json({ success: false, message: 'Failed to read course data' });
        }

        data.courseInfo = {
            ...data.courseInfo,
            ...req.body
        };

        if (writeAiccCourse(data)) {
            res.json({ success: true, message: 'Course info updated successfully', data: data.courseInfo });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save course info' });
        }
    } catch (error) {
        console.error('Error updating course info:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Upload video file
app.post('/api/aicc-course/upload-video', upload.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No video file uploaded' });
        }

        const data = readAiccCourse();
        if (!data) {
            return res.status(500).json({ success: false, message: 'Failed to read course data' });
        }

        data.videoInfo.uploadedVideo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            uploadedAt: new Date().toISOString()
        };

        if (writeAiccCourse(data)) {
            res.json({
                success: true,
                message: 'Video uploaded successfully',
                data: data.videoInfo.uploadedVideo
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save video info' });
        }
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Update YouTube video
app.post('/api/aicc-course/youtube-video', (req, res) => {
    try {
        const data = readAiccCourse();
        if (!data) {
            return res.status(500).json({ success: false, message: 'Failed to read course data' });
        }

        const { youtubeId, backgroundImage } = req.body;

        if (youtubeId) data.videoInfo.youtubeId = youtubeId;
        if (backgroundImage) data.videoInfo.backgroundImage = backgroundImage;

        if (writeAiccCourse(data)) {
            res.json({ success: true, message: 'YouTube video updated successfully', data: data.videoInfo });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save video info' });
        }
    } catch (error) {
        console.error('Error updating YouTube video:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET - Retrieve modules
app.get('/api/aicc-course/modules', (req, res) => {
    try {
        const data = readAiccCourse();
        if (data) {
            res.json({ success: true, data: data.modules });
        } else {
            res.status(500).json({ success: false, message: 'Failed to read modules' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Update modules
app.post('/api/aicc-course/modules', (req, res) => {
    try {
        const data = readAiccCourse();
        if (!data) {
            return res.status(500).json({ success: false, message: 'Failed to read course data' });
        }

        const { modules } = req.body;

        if (!Array.isArray(modules)) {
            return res.status(400).json({ success: false, message: 'Modules must be an array' });
        }

        data.modules = modules;

        if (writeAiccCourse(data)) {
            res.json({ success: true, message: 'Modules updated successfully', data: data.modules });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save modules' });
        }
    } catch (error) {
        console.error('Error updating modules:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ========================
// ASSIGNMENTS CONFIG ROUTES
// ========================
const assignmentsConfigPath = path.join(__dirname, 'config-assignments.json');

// Helper: Read assignments config
function readAssignmentsConfig() {
    try {
        if (!fs.existsSync(assignmentsConfigPath)) {
            const defaultConfig = { assignments: {} };
            fs.writeFileSync(assignmentsConfigPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        const data = fs.readFileSync(assignmentsConfigPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading assignments config:', error);
        return { assignments: {} };
    }
}

// Helper: Write assignments config
function writeAssignmentsConfig(config) {
    try {
        fs.writeFileSync(assignmentsConfigPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing assignments config:', error);
        return false;
    }
}

// GET - Retrieve all assignments configuration
app.get('/api/assignments-config', (req, res) => {
    try {
        const config = readAssignmentsConfig();
        res.json({ success: true, data: config.assignments });
    } catch (error) {
        console.error('Error retrieving assignments:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve assignments' });
    }
});

// GET - Retrieve specific assignment by ID
app.get('/api/assignments-config/:assignmentId', (req, res) => {
    try {
        const { assignmentId } = req.params;
        const config = readAssignmentsConfig();

        if (!config.assignments[assignmentId]) {
            return res.status(404).json({ success: false, message: `Assignment '${assignmentId}' not found` });
        }

        res.json({ success: true, data: config.assignments[assignmentId] });
    } catch (error) {
        console.error('Error retrieving assignment:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve assignment' });
    }
});

// PUT - Update entire assignment configuration
app.put('/api/assignments-config/:assignmentId', (req, res) => {
    try {
        const { assignmentId } = req.params;
        const config = readAssignmentsConfig();

        if (!config.assignments[assignmentId]) {
            return res.status(404).json({ success: false, message: `Assignment '${assignmentId}' not found` });
        }

        // Update the assignment with new data, preserving the ID
        config.assignments[assignmentId] = {
            ...req.body,
            id: assignmentId
        };

        if (writeAssignmentsConfig(config)) {
            res.json({
                success: true,
                message: `Assignment '${assignmentId}' updated successfully`,
                data: config.assignments[assignmentId]
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save assignment' });
        }
    } catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ========================
// ENROLLMENT MANAGEMENT API
// ========================
const enrollmentsDbPath = path.join(__dirname, 'enrollments.json');

// Helper: Read enrollments
function readEnrollments() {
    try {
        if (!fs.existsSync(enrollmentsDbPath)) {
            fs.writeFileSync(enrollmentsDbPath, JSON.stringify({ enrollments: [], lastUpdated: null }, null, 2));
        }
        const data = fs.readFileSync(enrollmentsDbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading enrollments:', error);
        return { enrollments: [], lastUpdated: null };
    }
}

// Helper: Write enrollments
function writeEnrollments(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(enrollmentsDbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing enrollments:', error);
        return false;
    }
}

// POST - Create new enrollment
app.post('/api/enrollments', (req, res) => {
    try {
        const { type, studentName, email, phone, course, batchDetails, courseTrack, preferredTime, batchSize, additionalNotes } = req.body;

        // Validate required fields
        if (!type || !studentName || !email) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Validate type
        if (!['online', 'offline', 'hybrid'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid enrollment type' });
        }

        const data = readEnrollments();

        // Create new enrollment
        const enrollment = {
            id: `ENR-${Date.now()}`,
            type,
            studentName,
            email,
            phone: phone || '',
            course: course || courseTrack || '',
            batchDetails: batchDetails || {},
            preferredTime: preferredTime || '',
            batchSize: batchSize || '',
            additionalNotes: additionalNotes || '',
            status: 'Pending',
            enrolledAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null
        };

        data.enrollments.push(enrollment);

        if (writeEnrollments(data)) {
            console.log(`✅ New ${type} enrollment created:`, enrollment.id);
            res.json({ success: true, message: 'Enrollment submitted successfully', enrollment });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save enrollment' });
        }
    } catch (error) {
        console.error('Error creating enrollment:', error);
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// GET - Get enrollments by type
app.get('/api/enrollments/:type', (req, res) => {
    try {
        const { type } = req.params;

        if (!['online', 'offline', 'hybrid', 'all'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid type' });
        }

        const data = readEnrollments();

        let enrollments = data.enrollments;
        if (type !== 'all') {
            enrollments = enrollments.filter(e => e.type === type);
        }

        res.json({ success: true, enrollments, total: enrollments.length });
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// PUT - Approve enrollment
app.put('/api/enrollments/:id/approve', (req, res) => {
    try {
        const { id } = req.params;
        const { reviewedBy } = req.body;

        const data = readEnrollments();
        const enrollment = data.enrollments.find(e => e.id === id);

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        }

        enrollment.status = 'Approved';
        enrollment.reviewedAt = new Date().toISOString();
        enrollment.reviewedBy = reviewedBy || 'Admin';

        if (writeEnrollments(data)) {
            console.log(`✅ Enrollment approved: ${id}`);
            res.json({ success: true, message: 'Enrollment approved', enrollment });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update enrollment' });
        }
    } catch (error) {
        console.error('Error approving enrollment:', error);
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// PUT - Reject enrollment
app.put('/api/enrollments/:id/reject', (req, res) => {
    try {
        const { id } = req.params;
        const { reviewedBy, reason } = req.body;

        const data = readEnrollments();
        const enrollment = data.enrollments.find(e => e.id === id);

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        }

        enrollment.status = 'Rejected';
        enrollment.reviewedAt = new Date().toISOString();
        enrollment.reviewedBy = reviewedBy || 'Admin';
        enrollment.rejectionReason = reason || '';

        if (writeEnrollments(data)) {
            console.log(`❌ Enrollment rejected: ${id}`);
            res.json({ success: true, message: 'Enrollment rejected', enrollment });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update enrollment' });
        }
    } catch (error) {
        console.error('Error rejecting enrollment:', error);
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});

// GET - Get enrollment statistics
app.get('/api/enrollments/stats/:type', (req, res) => {
    try {
        const { type } = req.params;
        const data = readEnrollments();

        let enrollments = data.enrollments;
        if (type !== 'all') {
            enrollments = enrollments.filter(e => e.type === type);
        }

        const stats = {
            total: enrollments.length,
            pending: enrollments.filter(e => e.status === 'Pending').length,
            approved: enrollments.filter(e => e.status === 'Approved').length,
            rejected: enrollments.filter(e => e.status === 'Rejected').length
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'SERVER_ERROR' });
    }
});



// ========================
// PASSWORD RESET API
// ========================

// POST - Forgot Password Request
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const normalizedEmail = email.trim();

        // 1. Check Trainers
        const trainersData = readTrainers();
        // Check both exact match and lowercase match for robustness
        const trainer = trainersData.trainers.find(t => t.email === normalizedEmail || t.email === normalizedEmail.toLowerCase());

        if (trainer) {
            const token = crypto.randomBytes(32).toString('hex');
            trainer.resetToken = token;
            trainer.resetTokenExpires = Date.now() + 3600000; // 1 hour

            if (writeTrainers(trainersData)) {
                await sendPasswordResetEmail(trainer.email, trainer.name, token);
                return res.json({ success: true, message: 'Password reset link sent to your email.' });
            }
        }

        // 2. Check Users (Students)
        const usersData = readUsers();
        // Users might have identifierType='email'
        const user = usersData.users.find(u => (u.identifierType === 'email' || !u.identifierType) && u.email === normalizedEmail);

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            user.resetToken = token;
            user.resetTokenExpires = Date.now() + 3600000; // 1 hour

            if (writeUsers(usersData)) {
                await sendPasswordResetEmail(user.email, user.firstName, token);
                return res.json({ success: true, message: 'Password reset link sent to your email.' });
            }
        }

        return res.status(404).json({ success: false, message: 'No account found with this email address.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST - Reset Password
app.post('/api/reset-password', (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and password are required' });

        // 1. Check Trainers
        const trainersData = readTrainers();
        const trainerIndex = trainersData.trainers.findIndex(t => t.resetToken === token && t.resetTokenExpires > Date.now());

        if (trainerIndex !== -1) {
            trainersData.trainers[trainerIndex].password = newPassword;
            trainersData.trainers[trainerIndex].resetToken = null;
            trainersData.trainers[trainerIndex].resetTokenExpires = null;

            if (writeTrainers(trainersData)) {
                return res.json({ success: true, message: 'Password reset successfully. You can now login.' });
            }
        }

        // 2. Check Users
        const usersData = readUsers();
        const userIndex = usersData.users.findIndex(u => u.resetToken === token && u.resetTokenExpires > Date.now());

        if (userIndex !== -1) {
            usersData.users[userIndex].password = newPassword;
            usersData.users[userIndex].resetToken = null;
            usersData.users[userIndex].resetTokenExpires = null;

            if (writeUsers(usersData)) {
                return res.json({ success: true, message: 'Password reset successfully. You can now login.' });
            }
        }

        return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========================
// GLOBAL ERROR HANDLERS
// ========================

// 404 Handler - Returns JSON instead of HTML
app.use((req, res) => {
    console.warn(`⚠️ 404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        message: 'ROUTE_NOT_FOUND',
        path: req.path,
        method: req.method,
        suggestion: 'Check if the API path and method are correct.'
    });
});

// Global Error Handler - Returns JSON instead of HTML
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'INTERNAL_SERVER_ERROR',
        error: err.message,
        path: req.path
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`╔════════════════════════════════════════════════════════╗`);
    console.log(`║   Tech-Pro AI Backend Server                           ║`);
    console.log(`║   Port: ${PORT}                                           ║`);
    console.log(`╠════════════════════════════════════════════════════════╣`);
    console.log(`║   APIs: users, payment, ailearning, online, offline   ║`);
    console.log(`║         hybrid, aicc, assignments, trainers, health   ║`);
    console.log(`╚════════════════════════════════════════════════════════╝`);
});
