import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../utils/helpers.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const commentAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
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
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  const comments = await Comment.aggregatePaginate(
    commentAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalComments",
        docs: "comments",
      },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const { videoId } = req.params;
  let { content } = req.body;
  content = content.trim();

  if (!content) {
    throw new ApiError(400, "Content field is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is invalid");
  }

  const comment = await Comment.create({ content, owner, video: videoId });
  const createdComment = await Comment.findById(comment._id).populate([
    {
      path: "owner",
      model: User,
      select: "fullName avatar email username",
    },
  ]);
  if (!createdComment) {
    throw new ApiError(500, "Something went wrong while creating comment");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdComment, "Create comment successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;
  let { content } = req.body;
  content = content.trim();

  if (!content) {
    throw new ApiError(400, "Content field is required");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(401, "Comment does not exist");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(401, "Unauthorized request");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: { content },
    },
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
    .json(new ApiResponse(200, updatedComment, "Update comment successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const userId = req.user._id;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(401, "Comment does not exist");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(401, "Unauthorized request");
  }

  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
