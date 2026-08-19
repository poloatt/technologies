import express from 'express';
import { checkAuth } from '../middleware/auth.js';
import { statsController } from '../controllers/statsController.js';

const router = express.Router();

router.use(checkAuth);

// Conteos de varios recursos en una sola request (hub/strip de Caja)
router.get('/counts', statsController.getCounts);

export default router;
