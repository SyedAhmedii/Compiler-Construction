# Vantor Studio

Web compiler workbench for the **Vantor** language (CS-554 Labs 2-4): lexer, parser, semantic analysis, three-address code + quadruples, and an interpreter. React (Vite) + Express + SQLite.

```
client/    React app        server/    Express API + compiler (server/src/compiler, pure JS)
database/  schema.sql (SQLite file is created here)
```

## Run it on your PC (no database install needed)
1. Install **Node.js 20+ LTS** from nodejs.org.
2. Terminal 1, in the project folder:
   ```
   cd server
   npm install
   npm start
   ```
   The API runs on http://localhost:4000. The SQLite file `database/vantor.db` is created and seeded automatically.
3. Terminal 2:
   ```
   cd client
   npm install
   npm run dev
   ```
4. Open **http://localhost:5173**. Ctrl+Enter runs a program.
5. Tests: `cd server && npm test`.

## API
`POST /api/compile {source}` · `GET /api/examples` · `GET /api/language` · `GET|POST /api/programs` · `DELETE /api/programs/:id` · `GET /api/history` · `GET /api/health`

## Deploy (everything on Vercel)
Import the GitHub repo in Vercel and leave **Root Directory = `./`** (the repo root). `vercel.json` handles the rest: it builds `client/` as the static site and serves the Express API from `api/index.js` on the same domain, so no env vars are needed.

On Vercel the SQLite file lives in `/tmp`, which is temporary: examples and the language data are re-seeded on every start, but saved programs and history reset when Vercel recycles the function. For permanent storage, host the backend on Render/Railway with a persistent disk (`npm start` in `server/`, set `DB_FILE` to a path on the disk and `CORS_ORIGIN` to the Vercel URL) and set `VITE_API_URL` on Vercel to that backend URL.

## Language guide for the professor
Grammar is on the Language page. Statements end with `;`; `^*` `^/` bind tighter than `^+` `^-`. Try:
```
hold num x ^= 2 ^+ 3 ^* 4;  reveal(x);                      // prints 14
hold frac f ^= 7 ^/ 2.0;    reveal(f);                      // prints 3.5
hold num i ^= 0; repeat (i ^< 3) { reveal(i); i ^= i ^+ 1; }  // 0 1 2
hold Text s ^= "hi"; when (s ^^ "hi") { reveal(on); }       // prints on
hold num a ^= "x";                                          // semantic error, line 1
```
## Decisions where the PDF is silent
`num ^/ num` is integer division; any `frac` operand gives float division; division by zero is a runtime error; execution stops after 100,000 instructions ("possible infinite loop"); uninitialized variables default to 0 / 0.0 / "" / off / empty glyph; Switch prints as on/off; strings print without quotes. `icg_loop_ifelse` prints **14** (four iterations add 1, i==3 adds 10).
