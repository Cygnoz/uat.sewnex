// v1.0

const User = require('../database/model/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const otpCache = new NodeCache({ stdTTL: 180 }); // 180 seconds
const rateLimit = require('express-rate-limit');

// Rate limiter for OTP verification to prevent brute force attacks
const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 OTP attempts per windowMs
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many OTP attempts, please try again after 5 minutes',
    });
  },
});

const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 5, // limit each IP to 5 login requests per windowMs
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts, please try again after 1 minute',
    });
  },
});

// Login 
exports.login = [loginRateLimiter, async (req, res) => {
  try {
    // Get all data
    const { email, password } = req.body;    

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password' });
    }

    // Find the user
    const user = await User.findOne({ userEmail:email });

    // Check if user exists
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found!' });
    }

    // Match the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Password!' });
    }

    // Generate OTP
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp ='111111';

    // Store OTP in cache with the email as the key
    otpCache.set(email, otp);

    // Send OTP email
    // const emailSent = await sendOtpEmail(user.userEmail, otp);
    // if (!emailSent) {
    //   return res.status(500).json({ success: false, message: 'Failed to send OTP, please try again' });
    // }

    res.status(200).json({
      success: true,
      message: 'OTP sent to email',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}];

// Verify OTP
exports.verifyOtp = [otpRateLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log(email, otp);

    // Validate input
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Please provide the OTP' });
    }

    // Find the user
    const user = await User.findOne({ userEmail:email });

    // Check if user exists
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found!' });
    }

    // Get OTP from cache
    const cachedOtp = otpCache.get(email);
    // console.log(`Cached OTP: ${cachedOtp}, Provided OTP: ${otp}`);

    // Check if OTP matches and is not expired
    if (cachedOtp && cachedOtp === otp) {


      // Capture IP address and User-Agent during verification
      const requestIP = req.ip || req.connection.remoteAddress; // Get IP address
      const requestUserAgent = req.headers['user-agent']; // Get User-Agent (browser/device info)

      console.log("Request IP :",requestIP);
      console.log("Request User Agent :",requestUserAgent);      

      
      // Create JWT token with user ID and organizationId
      const token = jwt.sign(
        {
          id: user._id,
          organizationId: user.organizationId,
          userName: user.userName,
          ip: requestIP,  // Bind IP address
          userAgent: requestUserAgent,  // Bind User-Agent (browser/device)
          iat: Math.floor(Date.now() / 1000), // issued at time
          nbf: Math.floor(Date.now() / 1000), // token valid from now 
        },
        process.env.JWT_SECRET, // JWT secret from environment variables
        { expiresIn: '12h' }
      );

      // Remove sensitive data from response
      user.password = undefined;

      // Send response with user data (excluding organizationId)
      res.status(200).json({
        success: true,
        token: `Bearer ${token}`, // Prepend "Bearer " to the token
        user: {
          id: user._id,
          email: user.userEmail,
          userName: user.userName,
          role: user.role,
        },
      });

      // Invalidate the OTP after successful verification
      otpCache.del(email);
    } else {
      res.status(401).json({ success: false, message: 'Invalid or expired OTP!' });
    }
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}];






// Nodemailer transporter setup using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// Function to send OTP email
// const sendOtpEmail = async (email, otp) => {
//   const mailOptions = {
//     from: `"BillBizz" <${process.env.EMAIL}>`,
//     to: email,
//     subject: 'BillBizz Software OTP',
//     text: `Hey there,

// Your One-Time Password (OTP) is: ${otp}

// This code is valid for 2 minutes. Please use it promptly to ensure secure access.

// Thanks for using our service!

// Cheers,

// BillBizz`,
//   };

//   return transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       console.error('Error occurred:', error);
//       return false;
//     } else {
//       console.log('Email sent:', info.response);
//       return true;
//     }
//   });
// };






// Function to send OTP email asynchronously
const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"BillBizz" <${process.env.EMAIL}>`,
    to: email,
    subject: 'BillBizz Software OTP',
    text: `Hey there,

Your One-Time Password (OTP) is: ${otp}

This code is valid for 2 minutes. Please use it promptly to ensure secure access.

Thanks for using our service!

Cheers,
BillBizz`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};