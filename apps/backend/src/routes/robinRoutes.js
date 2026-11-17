import express from 'express';
import { checkAuth } from '../middleware/auth.js';
import { robinController } from '../controllers/robinController.js';

const router = express.Router();

router.use(checkAuth);
router.get('/models', robinController.getModels);
router.post('/chat', robinController.chat);

export default router;
