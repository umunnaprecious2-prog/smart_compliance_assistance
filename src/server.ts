import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import uploadRouter from './routes/upload.route.ts';
import searchRoute from './routes/search.route.ts';
import chatRouter from './routes/chat.route.ts';
import indexRouter from './routes/indexing.route.ts';


const app = express();
const port = 3000;
app.use(cors());

app.use(express.json());

app.use(express.static(path.join(process.cwd())));

app.use('/upload', uploadRouter);
app.use('/api', searchRoute);
app.use('/api/chat', chatRouter);
app.use('/api/admin/index', indexRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
