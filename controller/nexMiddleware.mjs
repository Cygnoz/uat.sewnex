import jwt from 'jsonwebtoken';
const secretKey = process.env.NEX_JWT_SECRET; 

export function nexVerifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        req.token = bearerToken;

        jwt.verify(req.token, secretKey, (err, authData) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({ message: 'Token has expired' });
                } else {
                    return res.sendStatus(403);  
                }
            } else {
                const { organizationId } = authData;
                req.user = { organizationId };
                next(); 
            }
        });
    } else {
        res.sendStatus(403); 
    }
} 