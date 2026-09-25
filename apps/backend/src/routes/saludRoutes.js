import express from 'express';
import { saludController } from '../controllers/saludController.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(checkAuth);

router.get('/controles', saludController.getControles);
router.post('/controles', saludController.createControl);
router.put('/controles/:controlId', saludController.updateControl);
router.delete('/controles/:controlId', saludController.deleteControl);

router.get('/items', saludController.getItems);
router.post('/items', saludController.createItem);
router.put('/items/:id', saludController.updateItem);
router.delete('/items/:id', saludController.deleteItem);

export default router;
