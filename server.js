require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const server = express();

const accountRouter = require("./router/accountRouter")
require('./database/connection/connection')

// Define allowed origins
// const allowedOrigins = ['https://dev.billbizz.cloud', 'http://localhost:5173',  'http://localhost:5174']; 

// CORS configuration
// const corsOptions = {
//     origin: (origin, callback) => {
//         if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//             callback(null, origin);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     methods: ['GET', 'POST', 'PUT', 'DELETE'], 
//     allowedHeaders: ['Content-Type', 'Authorization'], 
//     credentials: true, 
// };

// Middleware
// server.use(cors(corsOptions));
server.use(cors())
server.use(helmet()); 
server.use(express.json());
server.use(accountRouter);

const PORT = 5001;

server.get('/',(req,res)=>{
    res.status(200).json("Bill BIZZ server started - Accounts")
})

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Accounts started at port : ${PORT}`);
})

