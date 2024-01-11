import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../utils/helpers.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriber = req.user._id;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "channelId is invalid");
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    throw new ApiError(404, "Channel does not exist");
  }

  if (channel._id.toString() === subscriber.toString()) {
    throw new ApiError(422, "You cannot subscriber yourself");
  }

  // Check if logged user is already subscriber the to be user channel
  const isAlreadySubscriber = await Subscription.findOne({
    subscriber,
    channel,
  });

  if (isAlreadySubscriber) {
    await Subscription.findOneAndDelete({ subscriber, channel });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isSubscriber: false },
          "Unsubscribe successfully"
        )
      );
  } else {
    await Subscription.create({ subscriber, channel });

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isSubscriber: true }, "Subscribe successfully")
      );
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const channel = await User.findById(channelId).select(
    "username email fullName avatar coverImage"
  );
  if (!channel) {
    throw new ApiError(404, "Channel does not exist");
  }

  const subscribersAggregate = Subscription.aggregate([
    {
      $match: { channel: channel._id },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              // lookup for the each user's profile
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "isSubscriber",
              pipeline: [
                {
                  // Only get documents where logged in user is subscriber
                  $match: {
                    channel: new mongoose.Types.ObjectId(req.user?._id),
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              isSubscriber: {
                $cond: {
                  if: {
                    $gte: [
                      {
                        $size: "$isSubscriber",
                      },
                      1,
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              // only project necessary fields
              username: 1,
              email: 1,
              avatar: 1,
              isSubscriber: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscriber: { $first: "$subscriber" },
      },
    },
    {
      $project: {
        _id: 0,
        subscriber: 1,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$subscriber",
      },
    },
  ]);

  const subscribers = await Subscription.aggregatePaginate(
    subscribersAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalSubscribers",
        docs: "subscribers",
      },
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { channel, subscribers },
        "Subscribers fetched successfully"
      )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const subscriber = await User.findById(subscriberId).select(
    "username email fullName avatar coverImage"
  );
  if (!subscriber) {
    throw new ApiError(404, "Subscriber does not exist");
  }

  const channelsAggregate = Subscription.aggregate([
    {
      $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $lookup: {
              // lookup for the each user's profile
              from: "subscriptions",
              localField: "_id",
              foreignField: "subscriber",
              as: "isSubscriber",
              pipeline: [
                {
                  // Only get documents where logged in user is subscriber
                  $match: {
                    subscriber: new mongoose.Types.ObjectId(req.user?._id),
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              isSubscriber: {
                $cond: {
                  if: {
                    $gte: [
                      {
                        $size: "$isSubscriber",
                      },
                      1,
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              // only project necessary fields
              username: 1,
              email: 1,
              avatar: 1,
              isSubscriber: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        channel: { $first: "$channel" },
      },
    },
    {
      $project: {
        _id: 0,
        channel: 1,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$channel",
      },
    },
  ]);

  const channels = await Subscription.aggregatePaginate(
    channelsAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalChannels",
        docs: "channels",
      },
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subscriber, channels },
        "Channels fetched successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
