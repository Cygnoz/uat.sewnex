// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const customerRouter = require("./router/customerRouter");
require('./database/connection/connection');

// Initialize the Express app
const server = express();
server.use(cors())
server.use(helmet());
server.use(express.json())

server.use(customerRouter)

const PORT = 5002

server.get('/',(req,res)=>{
    res.status(200).json("Bill BIZZ server started - Customer")
})

// Global error handling middleware
server.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error'
        }
    });
});

const app = server.listen(PORT, () => {
    console.log(`BillBIZZ server Customer started at port : ${PORT}`);
});

module.exports = app;