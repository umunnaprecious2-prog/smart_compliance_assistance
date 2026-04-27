import express from 'express';
import 'dotenv/config';
import uploadRouter from './routes/upload.route';

const app = express();
const port = 3000;

app.use(express.json());

app.use('/upload', uploadRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
