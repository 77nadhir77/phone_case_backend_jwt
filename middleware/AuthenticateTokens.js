const jwt = require('jsonwebtoken')
require("dotenv").config()


const authenticateTokens = (req, res, next) => {
    const authHeaders = req.headers['authorization']
    const authToken = authHeaders && authHeaders.split(' ')[1]

    if(!authToken) return res.sendStatus(401)

    jwt.verify(authToken, process.env.ACCESS_TOKEN_KEY, (err,user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            return res.sendStatus(403); // Token invalid
        }

        console.log(user)
        
        req.user = user
        next()
    })
}

module.exports = authenticateTokens