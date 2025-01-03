const mongoose = require('mongoose')

const DB = process.env.DATABASE

mongoose.connect(DB)
.then(()=>{
    console.log("📡...BillBizz Database Connected Successfully...📡");
}).catch((error)=>{
    console.log(`Database error ${error}`);
})






// const AWS = require('aws-sdk');
// const secretsManager = new AWS.SecretsManager({
//   region: 'ap-south-1' 
// });

// async function getSecret(secretName) {
//   try {
//     const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
//     if (data.SecretString) {
//       return JSON.parse(data.SecretString);
//     }
//   } catch (err) {
//     console.error("Error fetching secret:", err);
//     throw err;
//   }
// }


// // Example usage
// (async () => {
//     const DB = await getSecret('your-secret-name');
//   })();



//   mongoose.connect(DB)
//   .then(()=>{
//       console.log("📡...BillBizz Database Connected successfully...📡");
//   }).catch((error)=>{
//       console.log(`Database error ${error}`);
//   })