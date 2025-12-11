import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import workspaceRouter from './routes/workspaceRoutes.js';
import { protect } from './middlewares/authMiddleware.js';



dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get('/', (req, res) => res.send('Server is live'));
app.use("/api/inngest", serve({ client: inngest, functions }));

// Router
app.use("/api/workspaces",protect, workspaceRouter)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
