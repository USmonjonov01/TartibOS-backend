import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listReviews, createReview, deleteReview } from "../controllers/review.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", listReviews);
router.post("/", createReview);
router.delete("/:id", deleteReview);

export default router;