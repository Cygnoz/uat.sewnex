const users = require('../database/model/user')
const bcrypt = require('bcrypt')
const express = require('express')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const otpCache = new NodeCache({ stdTTL: 180 }); //180 seconds
const app = express();
app.use(cookieParser())


//Add Staff
exports.addStaff = async (req, res) => {
    try {
         const {email, password} = req.body

         if(!(email && password))
            {
                res.status(400).send('Email and Password required')
            }

         const existingUser = await users.findOne({email})
         if(existingUser) {
             res.status(401).send('User already Exists')
         }

         const encryptPassword = await bcrypt.hash(password, 10)

         const user = await users.create({
            email,
            password: encryptPassword

         })

         //generate a token for user and send it

         const token = jwt.sign(
            {id: user._id,password},
            'abcd', //jwt secret
            {
                expiresIn: "12h"
            }
         );

         user.token = token
         user.password = undefined

         res.status(201).json(user)

    }
    catch (error) {
        console.log(error)
    }
}