import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getMongoosePaginationOptions } from "../utils/helpers.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType,
    userId,
  } = req.query;

  const pipeline = [];
  const matchQuery = {
    isPublished: true,
  };

  if (query?.length > 0) {
    matchQuery.$or = [
      {
        title: {
          $regex: query.trim(),
          $options: "i",
        },
      },
      {
        description: {
          $regex: query.trim(),
          $options: "i",
        },
      },
    ];
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "userId is invalid");
    }

    matchQuery.owner = new mongoose.Types.ObjectId(userId);
  }

  pipeline.push({ $match: matchQuery });

  // lookup for the video owner
  pipeline.push(
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "totalLikes",
      },
    },
    {
      $addFields: {
        totalLikes: { $size: "$totalLikes" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              avatar: 1,
              email: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$owner",
    }
  );

  if (sortBy) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  }

  const videoAggregate = Video.aggregate(pipeline);
  const videos = await Video.aggregatePaginate(
    videoAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalVideos",
        docs: "videos",
      },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const { thumbnail, videoFile } = req.files;

  if (!title || !description) {
    throw new ApiError(400, "All fields are required");
  }

  const thumbnailLocalPath = thumbnail[0]?.path;
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail file is missing");
  }

  const videoLocalPath = videoFile[0]?.path;
  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is missing");
  }

  const thumbnailDetails = await uploadOnCloudinary(thumbnailLocalPath);
  if (!thumbnailDetails?.url) {
    throw new ApiError(400, "Error while uploading on thumbnail");
  }

  const videoFileDetails = await uploadOnCloudinary(videoLocalPath);
  if (!videoFileDetails?.url) {
    throw new ApiError(400, "Error while uploading on video");
  }

  const video = await Video.create({
    title,
    description,
    thumbnail: thumbnailDetails.url,
    videoFile: videoFileDetails.url,
    duration: videoFileDetails.duration || 0,
    owner: req.user._id,
  });

  const createdVideo = await Video.findById(video._id).populate([
    {
      path: "owner",
      model: User,
      select: "fullName avatar email username",
    },
  ]);
  if (!createdVideo) {
    throw new ApiError(500, "Something went wrong while video publishing");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdVideo, "Video publish successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  let { videoId } = req.params;
  videoId = videoId?.trim()?.toLowerCase();

  if (!videoId) {
    throw new ApiError(400, "videoId is missing");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const video = await Video.findById(videoId).populate([
    {
      path: "owner",
      model: User,
      select: "fullName avatar email username",
    },
  ]);

  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  if (
    !video.isPublished &&
    video.owner._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Video is no longer available for public access.");
  }

  video.views++;
  video.save({ validateBeforeSave: false });

  video._doc.totalLikes = await Like.countDocuments({ video: video._id });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "videoId is missing");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  const { title, description } = req.body;
  if (!title || !description) {
    throw new ApiError(400, "All fields are required");
  }

  const videoDetails = { title, description };

  const thumbnailLocalPath = req.file?.path;
  if (thumbnailLocalPath) {
    const thumbnailDetails = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnailDetails?.url) {
      throw new ApiError(400, "Error while uploading on thumbnail");
    }

    videoDetails.thumbnail = thumbnailDetails.url;
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: videoDetails },
    { new: true }
  ).populate([
    {
      path: "owner",
      model: User,
      select: "fullName avatar email username",
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
  let { videoId } = req.params;
  videoId = videoId?.trim()?.toLowerCase();

  if (!videoId) {
    throw new ApiError(400, "videoId is missing");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  await Video.findByIdAndDelete(videoId);
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  let { videoId } = req.params;
  videoId = videoId?.trim()?.toLowerCase();

  if (!videoId) {
    throw new ApiError(400, "videoId is missing");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const video = await Video.findById(videoId).populate([
    {
      path: "owner",
      model: User,
      select: "fullName avatar email username",
    },
  ]);

  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  if (video.owner._id.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  video.isPublished = !video.isPublished;
  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video,
        `Video marked ${
          video.isPublished ? "published" : "unpublished"
        } successfully`
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
