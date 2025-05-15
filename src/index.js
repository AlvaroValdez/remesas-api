require('dotenv').config();
const express = require('express');
const cors = require('cors');
const remesaRoutes = require('./routes/remesaRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/remesas', remesaRoutes);
app.get('/', (_req, res) => {
  res.send('✅ remesas-api OK');
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 remesas-api listening on http://localhost:${PORT}`);
});