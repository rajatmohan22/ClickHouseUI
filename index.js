const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const publicDirectory = path.join(__dirname);
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(bodyParser.json()); // For parsing application/json
app.set('view engine', 'ejs');


app.use(express.static(publicDirectory))


const PORT = process.env.PORT || 3000;

app.get(("/"),(req,res)=>{
    res.render("pages/index",{activePage: "home"});
})
app.post("/",async(req,res)=>{
  try {
    let originalQuery = req.body.query.trim();
    let query = originalQuery;

    // Add FORMAT if missing (for SELECT queries only)
    if (/^\s*SELECT/i.test(query) && !/FORMAT\s+/i.test(query)) {
      query = query.replace(/;*$/, '') + " FORMAT TabSeparatedWithNames";
    }

  if (!/FORMAT\s+/i.test(query)) {
    query = query.trim().replace(/;*$/, '') + " FORMAT TabSeparatedWithNames";
  }
  const forResponse = await fetch(`http://localhost:8123/`,{
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
  },
  body: query
  });

  const data = await forResponse.text();
  console.log(data)
  if (/Code:\s*\d+.*DB::Exception:/i.test(data)){
    const match = data.match(/DB::Exception:\s*(.*?)(?:\(|$)/);
if (match) return res.send(`Error: ${match[1].trim()}`);

  }
  

  const sendMessage = (action, name) =>
    res.send(`${action} '${name}' successfully.`);

  const tableRegex = /(?:CREATE|DROP|ALTER|TRUNCATE|RENAME)\s+TABLE\s+(IF\s+EXISTS\s+|IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)/i;
  const dbRegex = /(?:CREATE|DROP)\s+DATABASE\s+(IF\s+EXISTS\s+|IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i;
  const insertRegex = /INSERT\s+INTO\s+([a-zA-Z0-9_.]+)/i;
  const updateRegex = /ALTER\s+TABLE\s+([a-zA-Z0-9_.]+)/i;

  if (/^CREATE\s+TABLE/i.test(originalQuery)) {
    const match = originalQuery.match(tableRegex);
    return sendMessage("Table created", match?.[2] ?? "(unknown)");
  }

  if (/^DROP\s+TABLE/i.test(originalQuery)) {
    const match = originalQuery.match(tableRegex);
    return sendMessage("Table deleted", match?.[2] ?? "(unknown)");
  }

  if (/^CREATE\s+DATABASE/i.test(originalQuery)) {
    const match = originalQuery.match(dbRegex);
    return sendMessage("Database created", match?.[2] ?? "(unknown)");
  }

  if (/^DROP\s+DATABASE/i.test(originalQuery)) {
    const match = originalQuery.match(dbRegex);
    return sendMessage("Database deleted", match?.[2] ?? "(unknown)");
  }

  if (/^INSERT\s+INTO/i.test(originalQuery)) {
    const match = originalQuery.match(insertRegex);
    return sendMessage("Data inserted into", match?.[1] ?? "(unknown)");
  }

  if (/^ALTER\s+TABLE/i.test(originalQuery)) {
    const match = originalQuery.match(updateRegex);
    return sendMessage("Table updated", match?.[1] ?? "(unknown)");
  }


  console.log(data);
  res.send(data)
    
  } catch (error) {
    console.log(error)
    res.send("Something went wrong.");
  }
})

app.get("/drag",( req, res) => {
  res.render("pages/drag",{activePage: "drag"});
})
app.post("/drag", async (req, res) => {
  try {
    
  const { action, query, database } = req.body;

  if (action === 'listDatabases') {
    // GET /?query=SHOW%20DATABASES
    const chRes = await fetch(
      `http://localhost:8123/?query=${encodeURIComponent('SHOW DATABASES')}`,
      { method: 'GET' }
    );
    if (!chRes.ok) {
      const err = await chRes.text();
      return res.status(500).send(err);
    }
    const text = await chRes.text();
    const dbs = text
      .trim()
      .split('\n')
      .filter(x => x);
    return res.json(dbs);
  }

  // 1) Handle listTables entirely before touching `query`
  if (action === 'listTables') {
    if (typeof database !== 'string') {
      return res.status(400).send('Missing `database` for listTables');
    }
    console.log("database", database)
    const sql = `SHOW TABLES FROM ${database}`;
    const chRes = await fetch(
      `http://localhost:8123/?query=${encodeURIComponent(sql)}`,
      { method: 'GET' }
    );
    if (!chRes.ok) {
      const err = await chRes.text();
      return res.status(500).send(err);
    }
    const text = await chRes.text();
    const tables = text
      .trim()
      .split('\n')
      .filter(x => x);
    return res.json(tables);
  }

  // 2) Now we expect a real `query` string
  if (typeof query !== "string") {
    return res.status(400).send("Missing or invalid `query` in request body");
  }


    let originalQuery = query.trim();
    let sql = originalQuery;

    if (/^SELECT/i.test(sql) && !/FORMAT\s+/i.test(sql)) {
      sql = sql.replace(/;*$/, '') + " FORMAT TabSeparatedWithNames";
    }

    const response = await fetch(`http://localhost:8123/`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: sql
    });

    const data = await response.text();
    console.log(data, "data")

    if (/Code:\s*\d+.*DB::Exception:/i.test(data)) {
      const match = data.match(/DB::Exception:\s*(.*?)(?:\(|$)/);
      if (match) return res.send(`Error: ${match[1].trim()}`);
    }

    const tableRegex = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)/i;
    if (/^CREATE\s+TABLE/i.test(originalQuery)) {
      const match = originalQuery.match(tableRegex);
      return res.send(`✅ Table '${match?.[2] ?? "(unknown)"}' created successfully.`);
    }

    if (/^INSERT\s+INTO/i.test(sql)) {
      console.log("first")
      const m = sql.match(/INSERT\s+INTO\s+([A-Za-z0-9_.]+)/i);
      return res.send(
        `✅ Successfully inserted into '${m?.[1] ?? '(unknown)'}'.`
      );
    }

    res.send(data);
  } catch (err) {
    console.error(err);
    res.send("❌ Something went wrong.");
  }
});

app.listen((PORT), () => {
  console.log(`Server is running on port ${PORT}`);
})

