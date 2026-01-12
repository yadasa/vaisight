// server.js (Node.js backend)
const express = require('express');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer();
const client = new vision.ImageAnnotatorClient();

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint for OCR
app.post('/ocr-frame', upload.single('frame'), async (req, res) => {
  try {
    const [result] = await client.textDetection(req.file.buffer);
    const detections = result.textAnnotations;
    let price = '';
    if (detections.length > 0) {
      const fullText = detections[0].description;
      const match = fullText.match(/\$?\d+(\.\d{2})?/);
      if (match) price = match[0];
    }
    res.json({ text: price });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'OCR failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
