import express from 'express';
import { dietasController } from '../controllers/dietasController.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(checkAuth);

router.get('/plan', dietasController.getPlan);
router.put('/plan', dietasController.updatePlan);

router.get('/recetas', dietasController.getRecetas);
router.post('/recetas', dietasController.createReceta);
router.put('/recetas/:id', dietasController.updateReceta);
router.delete('/recetas/:id', dietasController.deleteReceta);

router.get('/menu', dietasController.getMenu);
router.put('/menu', dietasController.upsertMenu);

router.get('/habit-captions', dietasController.getHabitCaptions);

export default router;
