import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import uploadRouter from './routes/upload.route.ts';
import searchRoute from './routes/search.route.ts';
import chatRouter from './routes/chat.route.ts';
import indexRouter from './routes/indexing.route.ts';


const app = express();
const port = 3000;
app.use(cors());

app.use(express.json());

app.use(express.static(path.join(process.cwd(), 'public')));

// ============ SWAGGER CONFIGURATION ============
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Compliance Assistance API',
      version: '1.0.0',
      description: 'API for AI-powered document search and compliance assistance with PDF processing and semantic search capabilities',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development Server',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'Document ID',
            },
            filename: {
              type: 'string',
              description: 'Original filename',
            },
            uploadedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp',
            },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
            },
            content: {
              type: 'string',
              description: 'Chunk content',
            },
            similarity: {
              type: 'number',
              format: 'float',
              description: 'Similarity score (0-1)',
            },
            documentId: {
              type: 'number',
            },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
            },
            content: {
              type: 'string',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Session: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
            messages: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ChatMessage',
              },
            },
          },
        },
      },
    },
  },
  apis: [
    './src/routes/upload.route.ts',
    './src/routes/search.route.ts',
    './src/routes/chat.route.ts',
    './src/routes/indexing.route.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ============ API ROUTES ============
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/upload', uploadRouter);
app.use('/api', searchRoute);
app.use('/api/chat', chatRouter);
app.use('/api/admin/index', indexRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`📚 Swagger API Documentation: http://localhost:${port}/api-docs`);
});
