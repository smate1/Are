const Post = require('./Post');

class PostController {
  async createPost(req, res) {
    try {
      const { author, content } = req.body;
      const post = new Post({ author, content });
      await post.save();
      res.json(post);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Помилка створення поста' });
    }
  }

  async getAllPosts(req, res) {
    try {
      const posts = await Post.find().sort({ createdAt: -1 });
      res.json(posts);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Помилка завантаження постів' });
    }
  }

  async likePost(req, res) {
    try {
      const { postId } = req.body;
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Пост не знайдено' });
      }
      post.likes += 1;
      await post.save();
      res.json(post);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Помилка лайку поста' });
    }
  }
}

module.exports = new PostController();
