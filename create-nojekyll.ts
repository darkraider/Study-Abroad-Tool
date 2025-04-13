// create-nojekyll.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'out', '.nojekyll');

// Ensure the 'out' directory exists (optional, next build should create it)
// fs.mkdirSync(path.dirname(filePath), { recursive: true });

// Create an empty file (or overwrite if it exists)
try {
  fs.writeFileSync(filePath, '');
  console.log(`Created: ${filePath}`);
} catch (err) {
  console.error(`Error creating ${filePath}:`, err);
  process.exit(1); // Exit with error code if creation fails
}