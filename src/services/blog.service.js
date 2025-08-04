const {cloudinary} = require("../configs/cloudinary");
const { Blog } = require("../models");
const db = require("../models");
const fs = require("fs/promises");

//USER
async function getBlogByShelter(shelterId) {
  // for shelter staff
  try {
    const blogs = await db.Blog.find({
      shelter: shelterId,
      status: { $ne: "deleted" },
    })
      .populate("shelter createdBy")
      .sort({ createdAt: -1 });
    return blogs.map((blog) => ({
      _id: blog._id,
      shelter: {
        _id: blog.shelter._id,
        name: blog.shelter.name,
        avatar: blog.shelter.avatar,
        location: blog.shelter.location,
      },
      createdBy: {
        _id: blog.createdBy._id,
        fullName: blog.createdBy.fullName,
        avatar: blog.createdBy.avatar,
      },
      thumbnail_url: blog.thumbnail_url,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      status: blog.status,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    }));
  } catch (error) {
    throw error;
  }
}
const getListBlogs = async () => {
  try {
    const blogs = await db.Blog.find({ status: "published" })
      .populate("shelter createdBy")
      .sort({ createdAt: -1 });

    if (!blogs || blogs.length === 0) {
      throw new Error("Không có bài viết nào");
    }

    const result = blogs.filter((blog) => {
      if (blog.shelter.status === "active") {
        return {
          _id: blog._id,
          shelter: {
            _id: blog.shelter._id,
            name: blog.shelter.name,
            avatar: blog.shelter.avatar,
            location: blog.shelter.location,
          },
          createdBy: {
            _id: blog.createdBy._id,
            fullName: blog.createdBy.fullName,
            avatar: blog.createdBy.avatar,
          },
          thumbnail_url: blog.thumbnail_url,
          title: blog.title,
          description: blog.description,
          content: blog.content,
          status: blog.status,
          createdAt: blog.createdAt,
          updatedAt: blog.updatedAt,
        };
      }
    });

    return result;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bài viết:", error);
    throw new Error("Không thể lấy danh sách bài viết");
  }
};

const getPublishedBlogById = async (blogId) => {
    const blog = await db.Blog.findOne({
      _id: blogId,
      status: "published",
    }).populate("shelter createdBy");

    if (!blog) {
      throw new Error("Không tìm thấy blog");
    }
    return {
      _id: blog._id,
      shelter: {
        _id: blog.shelter._id,
        name: blog.shelter.name,
        avatar: blog.shelter.avatar,
        location: blog.shelter.location,
      },
      createdBy: {
        _id: blog.createdBy._id,
        fullName: blog.createdBy.fullName,
        avatar: blog.createdBy.avatar,
      },
      thumbnail_url: blog.thumbnail_url,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      status: blog.status,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
};
const getBlogById = async (blogId) => {
    const blog = await db.Blog.findById(blogId).populate("shelter createdBy");
    if (!blog) {
      throw new Error("Không tìm thấy blog");
    }
    return {
      _id: blog._id,
      shelter: {
        _id: blog.shelter._id,
        name: blog.shelter.name,
        avatar: blog.shelter.avatar,
        location: blog.shelter.location,
      },
      createdBy: {
        _id: blog.createdBy._id,
        fullName: blog.createdBy.fullName,
        avatar: blog.createdBy.avatar,
      },
      thumbnail_url: blog.thumbnail_url,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      status: blog.status,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
};

const getListBlogsByShelter = async (shelterId) => {
  try {
    const blogs = await db.Blog.find({
      shelter: shelterId,
      status: "published",
    })
      .populate("shelter createdBy")
      .sort({ createdAt: -1 });
    if (!blogs || blogs.length === 0) {
      throw new Error("Không có bài viết nào của trạm cứu hộ này");
    }

    const result = blogs.map((blog) => ({
      _id: blog._id,
      shelter: {
        _id: blog.shelter._id,
        name: blog.shelter.name,
        avatar: blog.shelter.avatar,
        location: blog.shelter.location,
      },
      createdBy: {
        _id: blog.createdBy._id,
        fullName: blog.createdBy.fullName,
        avatar: blog.createdBy.avatar,
      },
      thumbnail_url: blog.thumbnail_url,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      status: blog.status,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    }));

    return result;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bài viết của trạm cứu hộ:", error);
    throw new Error("Không thể lấy danh sách bài viết của trạm cứu hộ");
  }
};

const createBlog = async (userId, blogData, shelterId, file) => {
  try {
    const { title, description, content } = blogData;

    if (!shelterId) {
      throw new Error("ID trạm cứu hộ không được cung cấp");
    }

    if (!title || !content) {
      throw new Error("Tiêu đề và nội dung bài viết là bắt buộc");
    }

    let thumbnailUrl = "";
    if (file) {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: "blogs",
        resource_type: "image",
      });
      thumbnailUrl = uploadResult.secure_url;
      await fs.unlink(file.path);
    }else{
      thumbnailUrl = "https://drmango.vn/img/noimage-600x403-1.jpg";
    }

    const newBlog = await db.Blog.create({
      shelter: shelterId,
      createdBy: userId,
      thumbnail_url: thumbnailUrl,
      title,
      description,
      content,
      status: "published",
    });
    return newBlog;
  } catch (error) {
    if (file && file.path) {
      await fs.unlink(file.path);
    }
    console.error("Lỗi khi tạo bài viết:", error);
    throw new Error("Không thể tạo bài viết");
  }
};

const updateBlog = async (blogId, blogData, file) => {
  try {
    const { title, description, content } = blogData;

    if (!blogId) {
      throw new Error("ID bài viết không được cung cấp");
    }

    if (!title || !content) {
      throw new Error("Tiêu đề và nội dung bài viết là bắt buộc");
    }

    let thumbnailUrl = "";
    if (file) {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: "blogs",
        resource_type: "image",
      });
      thumbnailUrl = uploadResult.secure_url;
      await fs.unlink(file.path);
    }

    let updatedBlog;
    if (file) {
      updatedBlog = await db.Blog.findByIdAndUpdate(
        blogId,
        {
          thumbnail_url: thumbnailUrl,
          title,
          description,
          content,
        },
        { new: true }
      );
    } else {
      updatedBlog = await db.Blog.findByIdAndUpdate(
        blogId,
        {
          title,
          description,
          content,
        },
        { new: true }
      );
    }
    

    return updatedBlog;
  } catch (error) {
    if (file && file.path) {
      await fs.unlink(file.path);
    }
    console.error("Lỗi khi cập nhật bài viết:", error);
    throw new Error(error.message);
  }
};

const deleteBlog = async (blogId) => {
  try {
    if (!blogId) {
      throw new Error("ID bài viết không được cung cấp");
    }

    const deletedBlog = await db.Blog.findByIdAndUpdate(
      blogId,
      { status: "deleted" },
      { new: true }
    );

    return deletedBlog;
  } catch (error) {
    console.error("Lỗi khi xóa bài viết:", error);
    throw new Error("Không thể xóa bài viết");
  }
};
async function getRecommendedBlogs(blogId, shelterId) {
  try {
    const blogs = await Blog.aggregate([
      {
        $match: {
          _id: { $ne: blogId },
          shelter: shelterId,
          status: "published"
        },
      },
      { $sample: { size: 3 } },
    ]);
    if(blogs.length < 3){
        const fewBlogs =  await Blog.find({
        _id: { $ne: blogId },
        shelter: shelterId,
        status: "published",
      }).populate("shelter createdBy");
      return fewBlogs.filter((blog) => {
      if (blog.shelter.status === "active") {
        return {
          _id: blog._id,
          shelter: {
            _id: blog.shelter._id,
            name: blog.shelter.name,
            avatar: blog.shelter.avatar,
            location: blog.shelter.location,
          },
          createdBy: {
            _id: blog.createdBy._id,
            fullName: blog.createdBy.fullName,
            avatar: blog.createdBy.avatar,
          },
          thumbnailUrl: blog.thumbnail_url,
          title: blog.title,
          description: blog.description,
          content: blog.content,
          status: blog.status,
          createdAt: blog.createdAt,
          updatedAt: blog.updatedAt,
        };
      }
    });
    }else{
      return blogs.filter((blog) => {
      if (blog.shelter.status === "active") {
        return {
          _id: blog._id,
          shelter: {
            _id: blog.shelter._id,
            name: blog.shelter.name,
            avatar: blog.shelter.avatar,
            location: blog.shelter.location,
          },
          createdBy: {
            _id: blog.createdBy._id,
            fullName: blog.createdBy.fullName,
            avatar: blog.createdBy.avatar,
          },
          thumbnailUrl: blog.thumbnail_url,
          title: blog.title,
          description: blog.description,
          content: blog.content,
          status: blog.status,
          createdAt: blog.createdAt,
          updatedAt: blog.updatedAt,
        };
      }
    });
    }
  } catch (error) {
    throw error;
  }
}




// ADMIN
async function getAllBlogs() {
  try {
    const blogs =  await Blog.find({status: {$nin: ["deleted", "moderating"]}}).populate("shelter").sort({createdAt: -1});
    const result = blogs.map((blog) => ({
      _id: blog._id,
      shelter: {
        _id: blog.shelter._id,
        name: blog.shelter.name,
        avatar: blog.shelter.avatar,
        location: blog.shelter.location,
      },
      thumbnail_url: blog.thumbnail_url,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      status: blog.status,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    }));

    return result;
  } catch (error) {
    throw error;
  }
}
async function moderateBlog(blogId, decision = "reject") {
  try {
    const blog = await Blog.findById(blogId);
    if(!blog){
      throw new Error("Không tìm thấy blog!")
    }
    if(blog.status !== "moderating"){
      throw new Error("Blog không ở trạng thái chờ duyệt!")
    }

    if(!["approve", "reject"].includes(decision)){
      throw new Error("Không cung cấp quyết định phù hợp!")
    }
    if(decision === "approve"){
      blog.status = "published"
    }else{
      blog.status = "rejected"
    }
    await blog.save();
    
    return {
      status: 200,
      message: "Chấp thuận blog thành công"
    };
  } catch (error) {
    throw error;
  }
}
async function getModeratingBlogs() {
  try {
    const blogs =  await Blog.find({status: "moderating"}).populate("shelter").sort({createdAt: -1});
    const result = blogs.map((blog) => ({
      _id: blog._id,
      shelter: {
        _id: blog.shelter._id,
        name: blog.shelter.name,
        avatar: blog.shelter.avatar,
        location: blog.shelter.location,
      },
      thumbnail_url: blog.thumbnail_url,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      status: blog.status,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    }));

    return result;
  } catch (error) {
    throw error;
  }
}

const blogService = {
  //USER
  getListBlogs,
  getPublishedBlogById,
  getBlogById,
  getListBlogsByShelter,
  getBlogByShelter,
  createBlog,
  updateBlog,
  deleteBlog,
  getRecommendedBlogs,
  

  //ADMIN
  getAllBlogs,
  getModeratingBlogs,
  moderateBlog,
};

module.exports = blogService;
