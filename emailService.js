const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { secret, emailService, emailUser, emailPassword, baseUrl, isProduction } = require('./config');

// Create a reusable transporter object for email sending
let transporter;

// Setup email transporter
const setupTransporter = () => {
  if (transporter) return;

  if (!emailUser || !emailPassword) {
    // If email credentials are not provided, use ethereal for testing
    console.log('⚠️ No email credentials provided, using ethereal test account');
    return setupTestTransporter();
  }

  try {
    transporter = nodemailer.createTransport({
      service: emailService,
      auth: {
        user: emailUser,
        pass: emailPassword
      }
    });
    console.log('✅ Email service configured successfully');
  } catch (error) {
    console.error('❌ Error setting up email service:', error);
    // Fall back to test account
    setupTestTransporter();
  }
};

// Setup test transporter for development
const setupTestTransporter = async () => {
  try {
    // Generate test account
    const testAccount = await nodemailer.createTestAccount();

    // Create a test transporter
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    console.log('✅ Using ethereal test email account:', testAccount.user);
  } catch (error) {
    console.error('❌ Error creating test email account:', error);
    console.log('📧 Email functionality will be disabled');
  }
};

// Generate verification token
const generateVerificationToken = (userId, email) => {
  return jwt.sign(
    { id: userId, email },
    secret,
    { expiresIn: '24h' }
  );
};

// Generate reset token with enhanced security
const generateResetToken = (userId, email) => {
  // Add random component to make token more secure
  const randomBytes = require('crypto').randomBytes(32).toString('hex');

  // Include timestamp for additional security
  const timestamp = Date.now();

  return jwt.sign(
    {
      id: userId,
      email,
      purpose: 'reset',
      random: randomBytes,
      timestamp
    },
    secret,
    { expiresIn: '1h' }
  );
};

// Generate a secure hash of the reset token to store in the database
const generateResetTokenHash = (token) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Send verification email
const sendVerificationEmail = async (user) => {
  if (!transporter) {
    setupTransporter();
  }

  if (!transporter) {
    console.error('❌ Email service not available, skipping verification email');
    return false;
  }

  const token = generateVerificationToken(user._id, user.email);
  const verificationUrl = `${baseUrl}/verify.html?token=${token}`;

  try {
    const info = await transporter.sendMail({
      from: emailUser || '"Era Platform" <no-reply@era-platform.com>',
      to: user.email,
      subject: "Welcome to Era - Verify Your Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #0b93f6;">Welcome to Era Platform!</h2>
          <p>Hi ${user.username || user.fullName || 'there'},</p>
          <p>Thank you for registering with Era. To activate your account, please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #0b93f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Verify Email</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
            ${verificationUrl}
          </p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>Best regards,<br>The Era Team</p>
        </div>
      `
    });

    console.log('✅ Verification email sent:', info.messageId);

    // Log ethereal URL for testing
    if (!emailUser) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  if (!transporter) {
    setupTransporter();
  }

  if (!transporter) {
    console.error('❌ Email service not available, skipping reset email');
    return false;
  }

  // Якщо токен не передано, згенеруємо новий (для сумісності зі старим кодом)
  if (!resetToken) {
    resetToken = generateResetToken(user._id, user.email);
  }

  const resetUrl = `${baseUrl}/reset-password.html?token=${resetToken}`;

  try {
    const info = await transporter.sendMail({
      from: emailUser || '"Era Platform" <no-reply@era-platform.com>',
      to: user.email,
      subject: "Era - Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #0b93f6;">Password Reset Request</h2>
          <p>Hi ${user.username || user.fullName || 'there'},</p>
          <p>We received a request to reset your password. If you did not make this request, please ignore this email.</p>
          <p>To reset your password, click the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #0b93f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reset Password</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
            ${resetUrl}
          </p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>Best regards,<br>The Era Team</p>
        </div>
      `
    });

    console.log('✅ Password reset email sent:', info.messageId);

    // Log ethereal URL for testing
    if (!emailUser) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
};

// Send location alert email
const sendLocationAlertEmail = async (user, location) => {
  if (!transporter) {
    setupTransporter();
  }

  if (!transporter) {
    console.error('❌ Email service not available, skipping location alert email');
    return false;
  }

  const locationUrl = `${baseUrl}/map.html?location=${location._id}`;

  try {
    const info = await transporter.sendMail({
      from: emailUser || '"Era Platform" <no-reply@era-platform.com>',
      to: user.email,
      subject: `Era - New Location Near You: ${location.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #0b93f6;">New Location Alert</h2>
          <p>Hi ${user.username || user.fullName || 'there'},</p>
          <p>A new location has been added near you!</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">${location.name}</h3>
            ${location.address ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${location.address}</p>` : ''}
            ${location.description ? `<p style="margin: 5px 0;">${location.description}</p>` : ''}
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${locationUrl}" style="background-color: #0b93f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">View Location</a>
          </p>
          <p>Best regards,<br>The Era Team</p>
        </div>
      `
    });

    console.log('✅ Location alert email sent:', info.messageId);

    // Log ethereal URL for testing
    if (!emailUser) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending location alert email:', error);
    return false;
  }
};

// Initialize the email service
setupTransporter();

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLocationAlertEmail,
  generateVerificationToken,
  generateResetToken,
  generateResetTokenHash
};
