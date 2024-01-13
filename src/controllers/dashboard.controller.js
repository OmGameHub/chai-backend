import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getAllVideos } from "./video.controller.js";

const getChannelStats = asyncHandler(async (req, res) => {
  let userId = req.user._id;

  const totalSubscribers = await Subscription.countDocuments({
    channel: userId,
  });
  const videosStats = await Video.aggregate([
    {
      $match: { owner: userId },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalLikes: { $sum: { $size: "$likes" } },
        totalViews: { $sum: "$views" },
      },
    },
  ]);

  const dashboardStats = Object.assign(
    { totalVideos: 0, totalLikes: 0, totalSubscribers },
    videosStats?.[0],
    { _id: userId }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, dashboardStats, "Channel stats fetch successfully")
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  req.query.userId = req.user._id;
  getAllVideos(req, res);
});

export { getChannelStats, getChannelVideos };
