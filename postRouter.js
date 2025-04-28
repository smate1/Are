const Router = require('express');
const postController = require('./postController');
const router = new Router();

router.post('/create', postController.createPost);
router.get('/all', postController.getAllPosts);
router.post('/like', postController.likePost);

module.exports = router;
