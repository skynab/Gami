---
name: start-site
description: Start (or run) the Gami website locally, check it's really working at localhost (pages, code, model files, the 3D viewer, no console errors), and give the user a link to open it. Use when asked to run, start, launch, serve or open the program, site, website or app.
---

# Start the Gami website

Gami is a Vite + React app. Locally it runs as the Vite dev server, set up in `.claude/launch.json` as `dev`
(`npm run dev -- --port 5180 --strictPort`). Built-in models are static files in `public/models/`, served at
`/models/<id>.fold`.

## 1. Start the dev server

- **In the Claude desktop app**: call `preview_start` with `{ name: "dev" }`. It reuses this session's server
  if it's already running. **Note the port in its result**: when 5180 is taken (another session's server, maybe
  from another checkout), the app moves this one to a free port such as 5182. Use that port from here on.
- **Elsewhere** (a plain terminal): if nothing is listening on the port yet, run `npm run dev -- --port 5180
  --strictPort` in the background and wait for Vite's "ready" line. If it says the port is in use, something
  else holds 5180: pick another port (5181, …) rather than assuming that server is this checkout.
- If `node_modules` is missing, run `npm install` first.

Don't use some other server already on 5180 without starting this session's own: it may be serving an older
or different copy of the code.

## 2. Check it's working

With `PORT` set to the port from step 1:

```bash
PORT=5180
base=http://localhost:$PORT
# The page itself, the app's code (Vite answers 500 if it doesn't compile), and a model file. Unknown paths
# fall back to the app's HTML page, so the model file must really come back as JSON.
curl -s -o /dev/null -w "page %{http_code}\n" $base/
curl -s $base/ | grep -o "<title>[^<]*</title>"
curl -s -o /dev/null -w "code %{http_code}\n" $base/src/main.tsx
curl -s $base/models/paper-plane.fold | head -c 12; echo
```

Expect `page 200`, `<title>Gami</title>`, `code 200`, and `{"file_spec"`. Anything else: read the server's
output (`preview_logs` with level `error`, or the terminal), fix the cause, and check again.

Then look at it in a browser (the browser pane: `navigate` to `$base/`):

1. The gallery shows "Learn to fold" and model cards. `read_console_messages` with `onlyErrors: true` is empty.
2. Open a model, e.g. `$base/learn/paper-plane`. The top bar reads "Step 1 of N" and a screenshot shows the
   paper drawn in 3D (a blank grey stage means the viewer failed). No console errors.
3. Press **Next step** once: the step and the address's `?step=` go to 2.

## 3. Give the user the link

Reply with the address as a link they can open, using the real port, for example:

> The site is running at **[http://localhost:5180](http://localhost:5180)**. Checked: the gallery, a model in
> the 3D viewer and stepping through it, with no errors.

Say what you checked, and anything that didn't pass. Leave the server running; stop it only if asked
(`preview_stop`, or stop the background command).
