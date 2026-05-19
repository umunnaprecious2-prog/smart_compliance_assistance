import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearEmbeddings() {
    try {
        // Use raw SQL to clear embeddings since they're stored as vector type
        await prisma.$executeRaw`UPDATE "DocumentChunk" SET embedding = NULL, "embeddingGenerated" = false`;

        // Get count for confirmation
        const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "DocumentChunk" WHERE embedding IS NULL`;
        const count = result[0]?.count || 0;

        console.log(`✓ Cleared embeddings from database`);
        console.log(`✓ ${count} chunks now have NULL embeddings`);
        console.log("✓ Embeddings will be regenerated with OpenAI on next search");
    } catch (error) {
        console.error("Error clearing embeddings:", error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

clearEmbeddings();
