// require('dotenv').config({path: './env'})

import dotenv from 'dotenv';

import connectDB from "./db/index.js";

dotenv.config({
    path: './env'
})



connectDB()
.then(() => {
    const port = process.env.PORT || 8000
    app.listen( port , () => {
        console.log(`Server is running at PORT : ${port}`);  
    })
    app.on('error',(error) => {
        console.log('ERRR: ',error);  
        throw error 
    })
})
.catch((err) => {
    console.log("Mongo DB connection failed",err); 
})

