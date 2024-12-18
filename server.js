require('dotenv').config()

const express = require('express')

const cors = require('cors')

const server = express()

// Increase the limit for JSON payloads
server.use(express.json({ limit: '10mb' })); // Set limit to 10MB

// Increase the limit for URL-encoded payloads
server.use(express.urlencoded({ limit: '10mb', extended: true }));

const staffRouter = require("./router/staffRouter")

const expenseRouter = require("./router/expenseRouter")

require('./database/connection/connection')

server.use(cors())

server.use(express.json())

server.use(staffRouter,expenseRouter)

PORT = 5008

server.get('/',(req,res)=>{
    res.status(200).json("Dev Bill BIZZ server started - Staff(v1)")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Staff started at port : ${PORT}`);
})

