require('dotenv').config()

const express = require('express')

const cors = require('cors')

const server = express()

const customerRouter = require("./router/customerRouter")

require('./database/connection/connection')

server.use(cors())

server.use(express.json())

server.use(customerRouter)

const PORT = 5002

server.get('/',(req,res)=>{
    res.status(200).json("Bill BIZZ server started - Customer")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Customer started at port : ${PORT}`);

})

