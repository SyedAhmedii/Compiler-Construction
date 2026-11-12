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

## Deploy
- **Frontend (Vercel):** root `client`, framework Vite, env `VITE_API_URL` = backend URL (no trailing slash).
- **Backend (Render/Railway):** root `server`, build `npm install`, start `npm start`, env `CORS_ORIGIN` = your Vercel URL. SQLite lives in a file, so attach a persistent disk and set `DB_FILE` to a path on it (otherwise saved programs reset on each deploy).

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
