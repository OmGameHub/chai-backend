import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const { content } = req.body;

  if (!content.trim()) {
    throw new ApiError(400, "Content field is required");
  }

  const tweet = await Tweet.create({ content, owner });

  if (!tweet) {
    throw new ApiError(500, "Something went wrong while creating tweet");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, tweet, "Create tweet successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  let { userId } = req.params;
  userId = userId?.trim()?.toLowerCase();

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "userId is invalid");
  }

  const tweets = await Tweet.find({ owner: userId }).sort({ _id: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  let { content } = req.body;
  content = content.trim();

  if (!content) {
    throw new ApiError(400, "Content field is required");
  }

  let { tweetId } = req.params;
  tweetId = tweetId?.trim()?.toLowerCase();

  if (!tweetId) {
    throw new ApiError(400, "tweetId is missing");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "tweetId is invalid");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet does not exist");
  }

  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: { content },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  let { tweetId } = req.params;
  tweetId = tweetId?.trim()?.toLowerCase();

  if (!tweetId) {
    throw new ApiError(400, "tweetId is missing");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "tweetId is invalid");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet does not exist");
  }

  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  await Tweet.findByIdAndDelete(tweetId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Delete tweet successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
