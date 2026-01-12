const express = require('express');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB max
const client = new vision.ImageAnnotatorClient();

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * STRICT price regex:
 * - Dollar sign REQUIRED
 * - Decimal REQUIRED
 * - Prevents barcodes & SKUs
 */
const PRICE_REGEX = /\$\s?\d{1,3}\.\d{2}/g;
const MAX_REASONABLE_PRICE = 200;

function extractBestPrice(annotations) {
  if (!annotations || annotations.length === 0) return null;

  const fullText = annotations[0].description || '';
  const matches = fullText.match(PRICE_REGEX) || [];

  if (matches.length === 0) return null;

  // Normalize + validate
  const candidates = matches
    .map(m => m.replace(/\s/g, ''))
    .filter(m => {
      const value = parseFloat(m.replace('$', ''));
      return !isNaN(value) && value > 0 && value <= MAX_REASONABLE_PRICE;
    });

  if (candidates.length === 0) return null;

  // Prefer lowest price (usually the shelf price, not per-unit)
  candidates.sort((a, b) =>
    parseFloat(a.replace('$', '')) - parseFloat(b.replace('$', ''))
  );

  return candidates[0];
}

app.post('/ocr-frame', upload.single('frame'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ price: null });
    }

    const [result] = await client.textDetection(req.file.buffer);
    const price = extractBestPrice(result.textAnnotations);

    res.json({ price });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ price: null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Vaisight running at http://localhost:${PORT}`)
);
