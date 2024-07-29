require('dotenv').config()

const express = require('express')

const cors = require('cors')

const server = express()

const reportRouter = require("./router/reportRouter")

require('./database/connection/connection')

server.use(cors())

server.use(express.json())

server.use(reportRouter)

PORT = 5006

server.get('/',(req,res)=>{
    res.status(200).json("Bill BIZZ server started - Report ")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Report started at port : ${PORT}`);

})

