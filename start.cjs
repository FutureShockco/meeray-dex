const path = require('path');
const express = require('express');
const app = express();
const port = process.env.VITE_PORT || 4000;

const distPath = path.join(__dirname, 'dist');

// Serve static files
app.use(express.static(distPath));

// Catch-all route
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ App running at http://localhost:${port}`);
});