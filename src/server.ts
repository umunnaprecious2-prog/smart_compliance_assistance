import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import uploadRouter from './routes/upload.route.ts';
import searchRoute from './routes/search.route.ts';
import chatRouter from './routes/chat.route.ts';


const app = express();
const port = 3000;
app.use(cors());

app.use(express.json());

app.use('/upload', uploadRouter);
app.use('/api', searchRoute);
app.use('/api/chat', chatRouter);



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
