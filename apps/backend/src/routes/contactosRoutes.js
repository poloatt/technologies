import express from 'express';
import { contactosController } from '../controllers/contactosController.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(checkAuth);

router.get('/', contactosController.getAll);
router.post('/backfill-mp', contactosController.backfillMp);
router.post('/', contactosController.create);

router.get('/:id/transacciones', contactosController.getTransacciones);
router.post('/:id/aplicar-categoria', contactosController.aplicarCategoria);
router.post('/:id/merge', contactosController.merge);
router.get('/:id', contactosController.getById);
router.put('/:id', contactosController.update);
router.delete('/:id', contactosController.delete);

export default router;
