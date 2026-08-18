# The Clubhouse

A private members' site: request to join, get approved, chat in a group room
or 1-on-1. Built with React + Vite, data stored in Supabase.

## 1. Create the database (Supabase)

1. Go to https://supabase.com, sign in, and click **New project**. Pick any
   name and region, and set a database password (you won't need to remember
   it for this app).
2. Once the project is ready, open the **SQL Editor** (left sidebar) and
   click **New query**.
3. Open `supabase-schema.sql` from this folder, paste its full contents in,
   and click **Run**. This creates the `members`, `group_messages`, and
   `dm_messages` tables.
4. Go to **Project Settings > API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key

## 2. Run it locally (optional, to test first)

```
cp .env.example .env
```
Edit `.env` and paste in your Project URL and anon key from step 1.

```
npm install
npm run dev
```
Open the local URL it prints. Sign up — the first account you create
automatically becomes the founder (that's you), with full approval powers.

## 3. Push to GitHub

```
git init
git add .
git commit -m "Initial commit: the clubhouse"
```
Create a new repo on GitHub, then:
```
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

## 4. Deploy on Vercel

1. Go to https://vercel.com, sign in with GitHub, and click **Add New >
   Project**.
2. Import the repo you just pushed. Vercel will auto-detect it as a Vite
   project — leave the build settings as default (`npm run build`, output
   directory `dist`).
3. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Project URL
   - `VITE_SUPABASE_ANON_KEY` → your anon public key
4. Click **Deploy**. In about a minute you'll get a live URL
   (`your-project.vercel.app`) — that's your real site. Share it with your
   club.

## Notes and limits

- **Security**: members log in with a username + passcode stored directly
  in the database (not hashed, not Supabase Auth). That's fine for a
  casual private club, but don't reuse a real password, and don't put
  sensitive data through this app.
- **Approvals**: the first person to sign up becomes the founder and can
  approve or decline anyone who requests to join afterward, from the
  sidebar.
- **Custom domain**: once deployed, you can attach your own domain under
  Vercel's Project Settings > Domains.
- To reset everything, just delete the rows in your Supabase tables (Table
  Editor in the Supabase dashboard).
