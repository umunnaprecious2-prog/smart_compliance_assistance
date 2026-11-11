Smart Compliance Assistant
Project Overview
This is a secure AI-powered system that allows users to upload documents and ask questions based strictly on the content of those files. It uses a retrieval method to ensure the AI does not make up information and only answers using the provided text.

Setup Instructions
Install Node.js on your computer if you have not already.

Open your terminal and navigate to the project folder.

Run the command: npm install
This will install all the necessary libraries for the project to function.

Environment Variables
You must create a file named .env in the root folder of the project. Copy and paste the following lines into that file and fill in your actual credentials:

PORT=3000
DATABASE_URL=your_postgresql_database_link_here
GEMINI_API_KEY=your_google_gemini_api_key_here
ADMIN_API_KEY=a_long_random_secret_at_least_16_characters

ADMIN_API_KEY protects the admin routes: uploading and listing documents (/upload) and indexing (/api/admin/index). Chat and search stay public. Generate a strong value, for example with:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
If ADMIN_API_KEY is missing or shorter than 16 characters, the admin routes are switched off (503).

Database Preparation
To prepare the database for storing document information, run this command:
npx prisma migrate dev --name init

How to Run the Server
To start the project in development mode, run this command:
npx tsx watch src/server.ts
The terminal will show a message saying Server running at http://localhost:3000.

Example API Calls
You can test the system using a tool like Postman.

To upload a document
Send a POST request to http://localhost:3000/upload
Add the header x-admin-key with your ADMIN_API_KEY value.
Attach your PDF file in the form-data section, under the key pdf.
In the web page, type the admin key in the box next to the Upload PDF button.

To ask a question
Send a POST request to http://localhost:3000/api/chat/ask
Use a raw JSON body like this:
{
"question": "What are the main safety rules in this document?"
}

Security Features
The system includes an automatic filter to prevent users from tricking the AI. If a user tries to send a command like ignore previous instructions, the system will block the request and return a security error message to keep the platform safe.