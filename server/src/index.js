// Local / Render / Railway entry point. On Vercel, api/index.js imports app.js instead.
import app from './app.js';

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Vantor API listening on ${port}`));
