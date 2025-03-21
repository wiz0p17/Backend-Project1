import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/apiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/apiResponse.js';


const registerUser = asyncHandler( async (req,res) => {
    
        //get user details from frontend
        //validation -- not empty
        //check if user already exist  : username email
        //check for images , check for avatar
        //upload them to cloudinary , avatar
        //create user object - create entry in db
        //remove password and refresh token form response
        //check for user creation 
        //return response else error

    const {fullname,email, username, password} = req.body
    console.log("email:",email);

    if(
        [fullname,email,username,password].some((field)=>field?.trim() === "")
    ){
        throw new ApiError(400,"all fields are required")
    }
    
    const existedUser = User.findOne({
        $or: [{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"avatar file is requrired")
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400,"avatar file is requrired")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowercase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while regestering a user")
    }

    return res.status(200).json(
        new ApiResponse(200,createdUser,"User Registered successfully")
    )

} )

export {registerUser}