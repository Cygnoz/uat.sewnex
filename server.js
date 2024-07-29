require('dotenv').config()

const express = require('express')

const cors = require('cors')

const server = express()

const purchaseRouter = require("./router/purchaseRouter")

require('./database/connection/connection')

server.use(cors())

server.use(express.json())

server.use(purchaseRouter)

PORT = 5005

server.get('/',(req,res)=>{
    res.status(200).json("Bill BIZZ server started - Purchase")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Purchase started at port : ${PORT}`);

})

