// v1.0

const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET; 

function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        req.token = bearerToken;
        
        jwt.verify(req.token, secretKey, (err, authData) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({ message: 'Token has expired' });
                } else {
                    return res.sendStatus(403);  // Forbidden for other token errors
                }
            } else {
                // Extract userId and organizationId from authData
                const { id: userId, organizationId, userName } = authData;
                
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
