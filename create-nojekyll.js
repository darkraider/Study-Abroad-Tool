// create-nojekyll.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'out', '.nojekyll');

try {
  // Ensure the 'out' directory exists before writing the file
  // This is important as 'next build' might clean the 'out' dir
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, ''); // Create empty file
  console.log(`Created/Ensured: ${filePath}`);
} catch (err) {
  console.error(`Error creating ${filePath}:`, err);
  process.exit(1); // Exit with error code
}