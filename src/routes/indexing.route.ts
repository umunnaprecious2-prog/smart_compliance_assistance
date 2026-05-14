import { Router } from 'express';
import { indexAllDocuments, getIndexingStatus } from '../services/indexing.service.ts';

const indexRouter = Router();

indexRouter.get('/status', async (req, res) => {
  try {
    const status = await getIndexingStatus();
    res.status(200).json({
      message: 'Indexing status retrieved',
      status,
    });
  } catch (error) {
    console.error('Status Check Error:', error);
    res.status(500).json({ error: 'Failed to retrieve indexing status' });
  }
});

indexRouter.post('/', async (req, res) => {
  try {
    const result = await indexAllDocuments();

    res.status(200).json({
      message: 'Indexing completed',
      result,
    });
  } catch (error) {
    console.error('Indexing Error:', error);
    res.status(500).json({ error: 'Failed to complete indexing' });
  }
});

export default indexRouter;
