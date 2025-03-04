require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');


const server = express();
const salesRouter = require("./router/salesRouter");
require('./database/connection/connection');

server.use(cors({
    origin: "*",
    methods: "GET, POST, PUT, DELETE, OPTIONS",
    allowedHeaders: "Content-Type, Authorization"
}));

server.options('*', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});

server.use(helmet()); 
server.use(express.json());
server.use(salesRouter);

const PORT = 4007

server.get('/',(req,res)=>{
    res.status(200).json("Dev Sewnex server started - Sales v1.6")
})

server.listen(PORT,()=>{
    console.log(`Sewnex server Sales started at port : ${PORT}`);
})

