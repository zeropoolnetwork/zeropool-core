// const express = require('express')
// const app = express()
// const port = 3000
//
// app.get('/', (req, res) => res.send('Hello World!'))
//
// app.listen(port, () => console.log(`Example app listening on port ${port}!`))


const http = require('http')
const port = 3000;
const requestHandler = (request, response) => {
    console.log(request.url)
    response.end('Hello Node.js Server!')
}

const server = http.createServer(requestHandler)
server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }    console.log(`server is listening on ${port}`)
})
