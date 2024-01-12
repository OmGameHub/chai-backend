import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../utils/helpers.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const likeQuery = {
    video: videoId,
    likedBy: req.user?._id,
  };

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  // Check if logged user is already liked or the video not
  const isAlreadyLiked = await Like.findOne(likeQuery);
  if (isAlreadyLiked) {
    await Like.findOneAndDelete(likeQuery);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: false }, "Un-like video successfully")
      );
  } else {
    await Like.create(likeQuery);

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: true }, "Like video successfully"));
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const likeQuery = {
    comment: commentId,
    likedBy: req.user?._id,
  };

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "commentId is invalid");
  }

  // Check if logged user is already liked the comment or not
  const isAlreadyLiked = await Like.findOne(likeQuery);
  if (isAlreadyLiked) {
    await Like.findOneAndDelete(likeQuery);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: false }, "Un-like comment successfully")
      );
  } else {
    await Like.create(likeQuery);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: true }, "Like comment successfully")
      );
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const likeQuery = {
    tweet: tweetId,
    likedBy: req.user?._id,
  };

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "tweetId is invalid");
  }

  // Check if logged user is already liked the tweet or not
  const isAlreadyLiked = await Like.findOne(likeQuery);
  if (isAlreadyLiked) {
    await Like.findOneAndDelete(likeQuery);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { isLiked: false }, "Un-like tweet successfully")
      );
  } else {
    await Like.create(likeQuery);

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: true }, "Like tweet successfully"));
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const likedVideoAggregate = Like.aggregate([
    {
      $match: {
        likedBy: req.user?._id,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    {
      $unwind: "$video",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);
  const likedVideos = await Like.aggregatePaginate(
    likedVideoAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalLikedVideos",
        docs: "likedVideos",
      },
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
