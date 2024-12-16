require('dotenv').config()

const express = require('express')
const cors = require('cors')

const server = express()
const supplierRouter = require("./router/supplierRouter")
require('./database/connection/connection')

server.use(cors())
server.use(express.json())
server.use(supplierRouter)

const PORT = 5009

server.get('/',(req,res)=>{
    res.status(200).json("Dev Bill BIZZ server started - Supplier")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Supplier started at port : ${PORT}`);
})

