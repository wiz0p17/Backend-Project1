import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/apiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/apiResponse.js';
import jwt from "jsonwebtoken";
import { response } from 'express';


const generateAccessAndRefreshToken = async(userId) =>
{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

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

    const {fullName,email, username, password} = req.body
    console.log("email:",email);

    if(
        [fullName,email,username,password].some((field)=>field?.trim() === "")
    ){
        throw new ApiError(400,"all fields are required")
    }
    
    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username already exist")
    }

    console.log("Req Files === ",req.files);
    

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0]
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"avatar file is requrired")
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400,"avatar file is requrired")
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
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


const loginUser = asyncHandler(async (req,res) => {
    //req body -> data
    //username or email
    // check password
    //access and refresh token
    //send cookie

    const {username , email, password} = req.body
    console.log(req.body)

    if(!username && !email){
        throw new ApiError(400, "password is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"user does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Password Invalid")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "user logged in successfully"
        )
    )

})


const logoutUser = asyncHandler( async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,{
            $set: {
                refreshToken: undefined
            }
        }, 
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"user logged out"))
})


const refreshAccessToken = asyncHandler( async(req,res) =>{
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incommingRefreshToken){
        throw new ApiError(401,"Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id)
    
        if(!user){
            throw new ApiError(401,"Invalid refresh Token")
        }
    
        if (incommingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,{accessToken,newRefreshToken},"Access Token Refreshed"))

    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler( async(req,res)=> {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect){
        throw new ApiError(401,"Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(new ApiResponse(200,{},"Password Change Successfully"))

})


const getCurrentUser = asyncHandler( async(req,res) => {
    res.status(200).json(200,req.user,"Current User fetched Successfully")
})


const updateAccountDetails = asyncHandler( (req,res) => {
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400,"All Fields Are Required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName ,
                email: email,

            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Account details Updated Successfully"))
})

const updateUserAvatar = asyncHandler( async(req,res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is Missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
        const user = await User.findByIdAndUpdate(req.user._id, 
            {
                $set: {
                    avatar: avatar.url
                }
            },
            {new: true} 
        ).select("-password")
        
        return res.status(200).json(200,user,"Avatar updated")
})

const updateUserCoverImage = asyncHandler( async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPathLocalPath){
        throw new ApiError(400,"Avatar file is Missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

        const user = await User.findByIdAndUpdate(req.user._id, 
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            {new: true} 
        ).select("-password")
    
        return res.status(200).json(200,user,"CoverImage updated Successfully")
})


export {registerUser,loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,updateUserAvatar,updateUserCoverImage}