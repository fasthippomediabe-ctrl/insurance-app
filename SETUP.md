# Insurance Management System — Setup Guide

## Step 1: Install Node.js

1. Go to: https://nodejs.org
2. Download the **LTS version** (the big green button)
3. Run the installer — click Next, Next, Next, Install
4. Open **Command Prompt** (search "cmd" in Start menu) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x` — that means it worked.

---

## Step 2: Create a Supabase Database (FREE)

1. Go to: https://supabase.com
2. Click **Start your project** → Sign up (use Google)
3. Click **New Project**:
   - Name: `insurance-app`
   - Database password: (write this down!)
   - Region: **Southeast Asia (Singapore)**
4. Wait ~2 minutes for it to set up
5. Go to **Project Settings → Database → Connection string**
6. Copy the **Transaction pooler** URL (it starts with `postgresql://`)

---

## Step 3: Configure Environment Variables

1. Open the file: `C:\Users\Bryan\Documents\insurance-app\.env.local`
2. Replace the placeholder values with your actual Supabase connection strings:
   - `DATABASE_URL` = Transaction pooler URL (port 6543)
   - `DIRECT_URL` = Direct connection URL (port 5432)
   - `AUTH_SECRET` = Any random long string (e.g. type 30 random characters)

---

## Step 4: Install and Set Up the App

Open **Command Prompt** and run these commands ONE BY ONE:

```cmd
cd C:\Users\Bryan\Documents\insurance-app

npm install

npm run db:generate

npm run db:push

npm run db:studio
```

> `db:studio` opens a visual database viewer — you can close it after checking.

Then seed the first admin user:
```cmd
npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts
```

---

## Step 5: Run the App

```cmd
cd C:\Users\Bryan\Documents\insurance-app
npm run dev
```

Then open your browser and go to: **http://localhost:3000**

Login with:
- **Username:** `admin`
- **Password:** `admin123`

> IMPORTANT: Go to Admin → Users → Change the admin password immediately!

---

## Step 6: First Things to Do After Login

1. **Admin → Branches** — Add all your branches (Kidapawan, etc.)
2. **Admin → Users** — Create one account per branch staff
3. **Admin → Agents** — Add your sales agents
4. **Admin → Collectors** — Add your collectors
5. **Import Records** — Upload your existing 6,000 member CSV file

---

## Deploying Online (for all branches to access)

Once working locally, deploy to Vercel for free:

1. Install Git: https://git-scm.com/download/win
2. Create free account at: https://vercel.com
3. Run:
   ```cmd
   cd C:\Users\Bryan\Documents\insurance-app
   npx vercel
   ```
4. Follow the prompts — it will give you a public URL like `https://insurance-app-xxx.vercel.app`
5. Add your `.env.local` values in Vercel → Project Settings → Environment Variables

All branches can then open that URL in any browser, anywhere.

---

## Project Location

All files are at: `C:\Users\Bryan\Documents\insurance-app\`
