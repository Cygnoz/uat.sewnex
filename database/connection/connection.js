const mongoose = require('mongoose')

const DB = process.env.DATABASE

mongoose.connect(DB)
.then(()=>{
    console.log("📡...Sewnex Database Connected Succesfully...📡");
}).catch((error)=>{
    console.log(`Database error ${error}`);
})


