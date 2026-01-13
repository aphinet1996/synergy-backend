import { Router } from 'express';
import authRoutes from '@routes/auth.route'
import userRoutes from '@routes/user.route'
import clinicRoutes from '@routes/clinic.route'
import taskRoutes from '@routes/task.route'
import todoRoutes from '@routes/todo.route'
import uploadRoutes from '@routes/upload.route'
import procedureRoutes from '@routes/procedure.route'

import positionRotes from '@routes/position.route'

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/clinic', clinicRoutes);
router.use('/task', taskRoutes);
router.use('/todo', todoRoutes);
router.use('/upload', uploadRoutes);
router.use('/procedure', procedureRoutes);

router.use('/position', positionRotes);

export default router;