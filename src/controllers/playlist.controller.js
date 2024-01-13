import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../utils/helpers.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  let { name, description } = req.body;
  name = name?.trim();
  description = description?.trim();

  if (!name || !description) {
    throw new ApiError(400, "All fields is required");
  }

  const playlist = await Playlist.create({ name, description, owner });

  if (!playlist) {
    throw new ApiError(500, "Something went wrong while creating playlist");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, playlist, "Create playlist successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "userId is invalid");
  }

  const playlistAggregate = Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $match: {
              isPublished: true,
            },
          },
          {
            $project: {
              thumbnail: 1,
              views: 1,
              duration: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        thumbnail: { $first: "$videos.thumbnail" },
        totalViews: { $sum: "$videos.views" },
        duration: { $sum: "$videos.duration" },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        thumbnail: 1,
        totalViews: 1,
        duration: 1,
      },
    },
  ]);

  const playlists = await Playlist.aggregatePaginate(
    playlistAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalPlaylists",
        docs: "playlists",
      },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, playlists, "Playlist fetch successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "playlistId is invalid");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $match: {
              isPublished: true,
            },
          },
          {
            $project: {
              thumbnail: 1,
              title: 1,
              description: 1,
              views: 1,
              duration: 1,
              isPublished: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        totalViews: { $sum: "$videos.views" },
        duration: { $sum: "$videos.duration" },
      },
    },
  ]);
  if (!playlist.length) {
    throw new ApiError(404, "Playlist does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Playlist fetch successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "playlistId is invalid");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist does not exist");
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  const isAlreadyAdded = playlist.videos.find(
    (video) => video.toString() === videoId
  );
  if (isAlreadyAdded) {
    throw new ApiError(409, "Video already exists");
  }

  playlist.videos.push(video._id);
  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video added to playlist successfully"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "playlistId is invalid");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist does not exist");
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  const isVideoExist = playlist.videos.find(
    (video) => video.toString() === videoId
  );
  if (!isVideoExist) {
    throw new ApiError(409, "Video does not exist");
  }

  playlist.videos = playlist.videos.filter(
    (video) => video.toString() !== videoId
  );
  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video removed to playlist successfully"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "playlistId is invalid");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist does not exist");
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  await Playlist.findByIdAndDelete(playlistId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist delete successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  let { name, description } = req.body;
  name = name?.trim();
  description = description?.trim();

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "playlistId is invalid");
  }

  if (!name || !description) {
    throw new ApiError(400, "All fields is required");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist does not exist");
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Forbidden request");
  }

  playlist.name = name;
  playlist.description = description;
  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist update successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
