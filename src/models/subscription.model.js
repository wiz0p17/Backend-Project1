import mongoose,{model, Schema} from "mongoose";

const subscriptionSchema = new Schema(
    {
        subscriber: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
},{timestamps: true})

export const Subscription = mongoose.model("Subscription",subscriptionSchema)