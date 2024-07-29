require('dotenv').config()

const express = require('express')

const cors = require('cors')

const server = express()

const salesRouter = require("./router/salesRouter")


require('./database/connection/connection')

server.use(cors())

server.use(express.json())

server.use(salesRouter)

PORT = 5007

server.get('/',(req,res)=>{
    res.status(200).json("Bill BIZZ server started - Sales ")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Sales started at port : ${PORT}`);
})

