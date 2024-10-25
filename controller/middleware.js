// v1.1

const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET; 
const revokedTokens = new Set();  // Store revoked tokens in memory for simplicity

function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        req.token = bearerToken;

         // Check if the token has already been revoked
         if (revokedTokens.has(req.token)) {
            return res.status(403).json({
                message: 'Token has been revoked. Please reauthenticate.'
            });
        }
                
        jwt.verify(req.token, secretKey, (err, authData) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({ message: 'Token has expired' });
                } else {
                    return res.sendStatus(403);  // Forbidden for other token errors
                }
            } else {

                const requestIP = req.ip || req.connection.remoteAddress; // Get request IP
                const requestUserAgent = req.headers['user-agent']; // Get request User-Agent

                // Extract userId and organizationId from authData
                const { id: userId, organizationId, userName, ip, userAgent } = authData;


                // Check if the IP and User-Agent match
                if (ip !== requestIP || userAgent !== requestUserAgent) {
                    
                    revokedTokens.add(req.token);

                    return res.status(401).json({
                    success: false,
                    message: 'Token revoked. Please reauthenticate.',
                    });
                }
                
                // Attach userId and organizationId to req object
                req.user = { id: userId, organizationId, userName };
                
                next();  // Pass control to the next middleware or route handler
            }
        });
    } else {
        res.sendStatus(403);  // Forbidden if token is not provided
    }
}

module.exports = { verifyToken };
