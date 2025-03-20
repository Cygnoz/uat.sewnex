// v1.0

const User = require('../database/model/user');
const Organization = require('../database/model/organization');
const Role = require('../database/model/role');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const otpCache = new NodeCache({ stdTTL: 180 }); // 180 seconds



// Login 
exports.login = async (req, res) => {
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

    const organization = await Organization.findOne({ organizationId: user.organizationId });

    // Check if organization exists
    if (!organization) {
      return res.status(401).json({ success: false, message: 'Organization not found!' });
    }
    // Check if organization is active
    if (!organization.isActive) {
      return res.status(401).json({ success: false, message: 'Organization is not active!' });
    }
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'User is not active!' });
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
};




// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

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

    const organization = await Organization.findOne({ organizationId: user.organizationId });
    if (!organization) {
      return res.status(401).json({ success: false, message: 'Organization not found!' });
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

      const isMobile = /mobile|tablet|android|iphone|ipad|ipod/i.test(requestUserAgent);
      const deviceType = isMobile ? "Mobile" : "Desktop";

      console.log("Device Type:", deviceType);  
      
      const role = await Role.findOne({ organizationId: user.organizationId ,roleName: user.role }).lean();      

      
      // Create JWT token with user ID and organizationId
      const token = jwt.sign(
        {
          id: user._id,
          organizationId: user.organizationId,
          organizationName: organization.organizationName,
          userName: user.userName,
          ip: requestIP,  // Bind IP address
          userAgent: requestUserAgent,  // Bind User-Agent (browser/device)
          iat: Math.floor(Date.now() / 1000), // issued at time
          nbf: Math.floor(Date.now() / 1000), // token valid from now 
        },
        process.env.JWT_SECRET, // JWT secret from environment variables
        // { expiresIn: '12h' }
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
          organizationName: organization.organizationName,
          permission: role?.permissions,
          deviceType
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
};






// Create a reusable transporter object using AWS SES
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false, // Use true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Skip TLS certificate validation (optional)
    },
  });
  







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












// Login 
exports.loginOTP = async (req, res) => {
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

    const organization = await Organization.findOne({ organizationId: user.organizationId });

    // Check if organization exists
    if (!organization) {
      return res.status(401).json({ success: false, message: 'Organization not found!' });
    }
    // Check if organization is active
    if (!organization.isActive) {
      return res.status(401).json({ success: false, message: 'Organization is not active!' });
    }
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'User is not active!' });
    }

    // Match the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Password!' });
    }



    // Capture IP address and User-Agent during verification
    const requestIP = req.ip || req.connection.remoteAddress; // Get IP address
    const requestUserAgent = req.headers['user-agent']; // Get User-Agent (browser/device info)

    console.log("Request IP :",requestIP);
    console.log("Request User Agent :",requestUserAgent);

    const isMobile = /mobile|tablet|android|iphone|ipad|ipod/i.test(requestUserAgent);
    const deviceType = isMobile ? "Mobile" : "Desktop";

    console.log("Device Type:", deviceType);  
    
    const role = await Role.findOne({ organizationId: user.organizationId ,roleName: user.role }).lean();      

    
    // Create JWT token with user ID and organizationId
    const token = jwt.sign(
      {
        id: user._id,
        organizationId: user.organizationId,
        organizationName: organization.organizationName,
        userName: user.userName,
        ip: requestIP,  // Bind IP address
        userAgent: requestUserAgent,  // Bind User-Agent (browser/device)
        iat: Math.floor(Date.now() / 1000), // issued at time
        nbf: Math.floor(Date.now() / 1000), // token valid from now 
      },
      process.env.JWT_SECRET, // JWT secret from environment variables
      // { expiresIn: '12h' }
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
        organizationName: organization.organizationName,
        permission: role?.permissions,
        deviceType
      },
    });

    
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
