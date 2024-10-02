require("dotenv").config()
const express = require('express')
const app = express()
const jwt = require('jsonwebtoken')
app.use(express.json())
const PORT = 8080


const posts = [
    {
        username: "admin",
        name: "post1"
    },
    {
        username: "Tyler",
        name: "post2"
    },
]

const authenticateToken = (request, response, next) => {
    const authHeader = request.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if(token === null) { return response.sendStatus(401)}

    jwt.verify(token , process.env.ACCESS_TOKEN_KEY, (err, user) => {
        if(err) return response.sendStatus(403)

        request.user = user
        next()
    })


}

app.get("/posts", authenticateToken, (request, response) => {

    const filteredPosts = posts.filter(post => post.username === request.user.username)

    response.json(filteredPosts)
})



app.listen(PORT, () => {
    console.log(`app is lestening on port: ${PORT}`)
})