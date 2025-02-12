// // v1.1

// const jwt = require('jsonwebtoken');
// const AWS = require('aws-sdk');
// const bodyParser =  require('body-parser');

// AWS.config.update({region:'ap-south-1'});

// const cognito = new AWS.CognitoIdentifyServiceProvider();
// const CLIENT_ID = '';

// application.use(bodyParser.json());

// const authenticateJWT = (req,res,next)=>{
//     const token = req.headers.authorization;

//     if (token){
//         jwt.verify( token, process.env.JWT_SECRET, ( err, user) => {
//             if(err){
//                 return res.sendStatus(403);
//             }
//             req.user = user;
//             next();
//         });
//     }else{
//         res.sendStatus(401);
//     }
// };



// //Sign up - post  (Add a New User)
// exports.signUp = async (req, res) => {
//     const{ contactName, contactNum, password, email } = req.body;

//     const params = {
//         ClientId: CLIENT_ID,
//         Username: contactName,
//         Password: hashedPassword,
//         UserAttributes:[
//             {
//                 Name: 'email',
//                 Value: email,
//             },
//             {
//               Name: 'phoneNumber', 
//               Value: contactNum,
//             }
//         ],
//     };
//     try {
//       const data = await cognito.signUp(params).promise();
//       res.json(data);
//     } catch (err) {
//       console.error(err);
//       res.status(400).json({ success: false, message: err });
//     }
//   };





// //Confirm - post (Otp Validation)
// exports.confirm = async (req, res) => {
//     const{ userName, confirmationCode } = req.body;

//     const params = {
//         ClientId: CLIENT_ID,
//         Username: userName,        
//         ConfirmationCode: confirmationCode,
//     };
//     try {
//       const data = await cognito.confirmSignUp(params).promise();
//       res.json(data);
//     } catch (err) {
//       console.error(err);
//       res.status(400).json({ success: false, message: err });
//     }
//   };







// //SignIn - post (User Entry)
// exports.signIn = async (req, res) => {
//     const{ userName, password } = req.body;

//     const params = {
//         AuthFlow: 'USER_PASSWORD_AUTH',
//         ClientId: CLIENT_ID,
//         Username: userName,
//         AuthParameters:{
//             USERNAME: userName,
//             PASSWORD: password,
//         },        
//     };
//     try {
//       const data = await cognito.initiateAuth(params).promise();
//       const token = jwt.sign({userName: data.AuthenticationResult.AccessToken}, process.env.JWT_SECRET, { expiresIn: '12h'});
//       res.json({token});
//     } catch (err) {
//       console.error(err);
//       res.status(400).json({ success: false, message: err });
//     }
//   };



// //SignOut - post 
// exports.signOut = authenticateJWT, async (req, res) => {
//     const token = req.headers.authorization;

//     const params = {
//         AccessToken: token,        
//     };

//     try {
//       await cognito.globalSignOut(params).promise();
//       res.json({ message: "Successfully Logged Out"});
//     } catch (err) {
//       console.error(err);
//       res.status(400).json({ success: false, message: err });
//     }
//   };



