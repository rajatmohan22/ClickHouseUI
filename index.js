const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const publicDirectory = path.join(__dirname);
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const { buildRealtimeURL } = require("openai/beta/realtime/internal-base.js");
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(bodyParser.json()); // For parsing application/json
app.set("view engine", "ejs");
require("dotenv").config(); // add at the top

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

const CH_USER = process.env.CLICKHOUSE_USER || "default";
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || "";

app.use(express.static(publicDirectory));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.render("pages/index", { activePage: "home" });
});
app.post("/", async (req, res) => {
  try {
    let originalQuery = req.body.query.trim();
    let query = originalQuery;

    // Add FORMAT if missing (for SELECT queries only)
    if (/^\s*SELECT/i.test(query) && !/FORMAT\s+/i.test(query)) {
      query = query.replace(/;*$/, "") + " FORMAT TabSeparatedWithNames";
    }

    if (!/FORMAT\s+/i.test(query)) {
      query = query.trim().replace(/;*$/, "") + " FORMAT TabSeparatedWithNames";
    }

    const authHeader =
      "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64");

    const forResponse = await fetch(`http://localhost:8123/`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: authHeader,
      },
      body: query,
    });

    const data = await forResponse.text();
    console.log(data);

    if (/Code:\s*\d+.*DB::Exception:/i.test(data)) {
      const match = data.match(/DB::Exception:\s*(.*?)(?:\(|$)/);
      if (match) return res.send(`Error: ${match[1].trim()}`);
    }

    const sendMessage = (action, name) =>
      res.send(`${action} '${name}' successfully.`);

    const tableRegex =
      /(?:CREATE|DROP|ALTER|TRUNCATE|RENAME)\s+TABLE\s+(IF\s+EXISTS\s+|IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)/i;
    const dbRegex =
      /(?:CREATE|DROP)\s+DATABASE\s+(IF\s+EXISTS\s+|IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i;
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

    res.send(data);
  } catch (error) {
    console.log(error);
    res.send("Something went wrong.");
  }
});

app.get("/drag", (req, res) => {
  res.render("pages/drag", { activePage: "drag" });
});
app.get("/parameter", (_, res) => {
  res.render("pages/parameter", { activePage: "parameter" });
});
app.post("/drag", async (req, res) => {
  try {
    const { action, query, database } = req.body;

    // Create auth header once
    const auth =
      "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64");

    // CASE 1: List all databases
    if (action === "listDatabases") {
      const chRes = await fetch(
        `http://localhost:8123/?query=${encodeURIComponent("SHOW DATABASES")}`,
        {
          method: "GET",
          headers: { Authorization: auth },
        }
      );

      if (!chRes.ok) {
        const err = await chRes.text();
        return res.status(500).send(err);
      }

      const text = await chRes.text();
      const dbs = text
        .trim()
        .split("\n")
        .filter((x) => x);
      return res.json(dbs);
    }

    // CASE 2: List tables from a database
    if (action === "listTables") {
      if (typeof database !== "string") {
        return res.status(400).send("Missing `database` for listTables");
      }

      const sql = `SHOW TABLES FROM ${database}`;
      const chRes = await fetch(
        `http://localhost:8123/?query=${encodeURIComponent(sql)}`,
        {
          method: "GET",
          headers: { Authorization: auth },
        }
      );

      if (!chRes.ok) {
        const err = await chRes.text();
        return res.status(500).send(err);
      }

      const text = await chRes.text();
      const tables = text
        .trim()
        .split("\n")
        .filter((x) => x);
      return res.json(tables);
    }

    // CASE 3: Handle direct SQL query
    if (typeof query !== "string") {
      return res.status(400).send("Missing or invalid `query` in request body");
    }

    let originalQuery = query.trim();
    let sql = originalQuery;
    console.log(query, "query");

    if (/^SELECT/i.test(sql) && !/FORMAT\s+/i.test(sql)) {
      sql = sql.replace(/;*$/, "") + " FORMAT TabSeparatedWithNames";
    }

    const response = await fetch(`http://localhost:8123/`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: auth,
      },
      body: sql,
    });

    const data = await response.text();
    console.log(data, "data");

    if (/Code:\s*\d+.*DB::Exception:/i.test(data)) {
      const match = data.match(/DB::Exception:\s*(.*?)(?:\(|$)/);
      if (match) return res.send(`Error: ${match[1].trim()}`);
    }

    // Feedback messages
    const tableRegex =
      /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)/i;
    if (/^CREATE\s+TABLE/i.test(originalQuery)) {
      const match = originalQuery.match(tableRegex);
      return res.send(
        `✅ Table '${match?.[2] ?? "(unknown)"}' created successfully.`
      );
    }

    if (/^INSERT\s+INTO/i.test(sql)) {
      const m = sql.match(/INSERT\s+INTO\s+([A-Za-z0-9_.]+)/i);
      return res.send(
        `✅ Successfully inserted into '${m?.[1] ?? "(unknown)"}'.`
      );
    }

    res.send(data);
  } catch (err) {
    console.error(err);
    res.send("❌ Something went wrong.");
  }
});

app.post("/parameter", async (req, res) => {
  const { db, table, limit } = req.body;
  if (!db || !table) return res.status(400).send("Missing db or table");

  const auth =
    "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64");

  try {
    const describeQuery = `DESCRIBE TABLE ${db}.${table} FORMAT TabSeparatedWithNames`;
    const dataQuery = `SELECT * FROM ${db}.${table} LIMIT ${limit} FORMAT TabSeparatedWithNames`;

    const [schemaRes, dataRes] = await Promise.all([
      fetch("http://localhost:8123", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "text/plain" },
        body: describeQuery,
      }),
      fetch("http://localhost:8123", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "text/plain" },
        body: dataQuery,
      }),
    ]);

    const schema = await schemaRes.text();
    const data = await dataRes.text();

    res.json({ schema, data });
  } catch (err) {
    res.status(500).send("Failed to fetch data");
  }
});

app.get("/parameter/dbs", async (req, res) => {
  try {
    const authHeader =
      "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64");

    const dbRes = await fetch("http://localhost:8123/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: authHeader,
      },
      body: "SHOW DATABASES",
    });

    const text = await dbRes.text();
    const dbs = text
      .trim()
      .split("\n")
      .filter((line, i) => i > 0); // skip header
    res.json(dbs);
  } catch (err) {
    console.error("Error fetching databases:", err.message);
    res.status(500).json({ error: "Could not fetch databases" });
  }
});

app.get("/parameter/tables", async (req, res) => {
  console.log("Fetching tables for db:", req.query.db);
  const db = req.query.db;

  if (!db) return res.status(400).json({ error: "Missing `db` query param" });

  try {
    const authHeader =
      "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64");

    const tableRes = await fetch("http://localhost:8123/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: authHeader,
      },
      body: `SHOW TABLES IN ${db}`,
    });

    const text = await tableRes.text();
    const tables = text
      .trim()
      .split("\n")
      .filter((line, i) => i >= 0);
    res.json(tables);
  } catch (err) {
    console.error("Error fetching tables:", err.message);
    res.status(500).json({ error: "Could not fetch tables" });
  }
});

app.post("/ai", async (req, res) => {
  const { db, table, schema } = req.body;
  const response = await client.responses.create({
    model: "gpt-4o",
    instructions:
      "You are a data analyst. Take the database, table and schema and formmulate some questions regarding descriptive stats. All regarding descriptive stats. Then convert these questions into meaningful input butons that the user can click on. Return an array that has the names of these 10 input buttons. Just return the array. Dont Say anything else. And just give me an array which is stringfied. No extra stuff. DOnt say ```json``` before the output",
    input: `Database: ${db}\nTable: ${table}\nSchema: ${schema}`,
  });
  const suggestions = JSON.parse(response.output_text);

  const structured = suggestions.map((label) => ({
    label,
    action: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ") // remove weird chars
      .trim()
      .replace(/\s+/g, "_"), // convert spaces to _
  }));

  const buttons = structured.map((item) => item.label);
  console.log(buttons, "buttons");
  res.send(buttons);
});

app.post("/ai/query", async (req, res) => {
  const { query, db, table, schema } = req.body;

  const response = await client.responses.create({
    model: "gpt-4o",
    instructions:
      "You are a Clickhouse SQL expert. Take the database, table and schema and convert the question into a Clickhouse SQL query. The query should be valid and executable in Clickhouse. Do not return any explanation or additional text, just return the SQL query as a string. Don't say ```sql``` before the output",
    input: `Database: ${db}\nTable: ${table}\nSchema: ${schema}\nQuestion: ${query}`,
  });

  let sqlQuery = response.output_text.replace(/```sql\s*|\s*```/g, "").trim();

  if (!sqlQuery) {
    return res.status(400).json({ error: "No SQL query generated" });
  }

  // Ensure FORMAT is present
  if (/^SELECT/i.test(sqlQuery) && !/FORMAT\s+\w+/i.test(sqlQuery)) {
    sqlQuery = sqlQuery.replace(/;*$/, "") + " FORMAT TabSeparatedWithNames";
  }

  try {
    const resultfromCH = await fetch("http://localhost:8123/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization:
          "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64"),
      },
      body: sqlQuery,
    });

    const rawText = await resultfromCH.text();
    if (!rawText) {
      return res
        .status(500)
        .json({ error: "No data returned from Clickhouse" });
    }

    return res.json({
      label: query,
      data: rawText,
    });
  } catch (err) {
    console.error("ClickHouse error:", err);
    return res.status(500).json({ error: "Failed to execute query" });
  }
});

app.post("/ui", async (req, res) => {
  const { db, table, schema } = req.body;
  const response = await client.responses.create({
    model: "gpt-4o",
    instructions:
      "You are a data scientist. Given the database, table, and schema, generate only 4-5 relevent data visualization questions strictly based on the provided schema. Do not use any information beyond the schema. Then, transform these questions into concise, meaningful input button labels that users can click. Return a single stringified array containing exactly 10 button names. Output only the stringified array—no explanations, no code blocks, and no additional text. The output should have label, action and type. The type of data viz that can be done like - historgram, ",
    input: `Database: ${db}\nTable: ${table}\nSchema: ${schema}`,
  });
  const suggestions = JSON.parse(response.output_text);
  console.log(suggestions, "suggestions");

  let structured = suggestions.map((label) => ({
    label,
    action: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ") // remove weird chars
      .trim()
      .replace(/\s+/g, "_"), // convert spaces to _
  }));

  // structured = structured.map((item) => item.label);
  console.log(structured, "buttons");
  res.json({ uiComponents: structured });
});

app.post("/ui/chart", async (req, res) => {
  const { action, db, table, schema } = req.body;

  try {
    const response = await client.responses.create({
      model: "gpt-4o",
      instructions: `
You're a ClickHouse expert. Based on the given table schema and the action name (e.g., "bar_chart_salary_by_name"), generate a valid SELECT query that can be visualized in a chart.

Requirements:
- Return ONLY the SQL query.
- Do not include explanations or code blocks.
- Query must end with: FORMAT JSON
- Make sure the query is executable in ClickHouse.
`,
      input: `Database: ${db}\nTable: ${table}\nSchema:\n${schema}\nAction: ${action}`,
    });

    let sqlQuery = response.output_text.replace(/```sql\s*|```/g, "").trim();

    if (!/FORMAT\s+JSON/i.test(sqlQuery)) {
      sqlQuery = sqlQuery.replace(/;*$/, "") + " FORMAT JSON";
    }

    const chRes = await fetch("http://localhost:8123/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization:
          "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64"),
      },
      body: sqlQuery,
    });

    const chData = await chRes.json();

    if (!chData || !chData.data) {
      return res.status(500).json({ error: "Invalid data from ClickHouse" });
    }

    const keys = Object.keys(chData.data[0] || {});
    if (keys.length < 2) {
      return res.status(400).json({ error: "Not enough columns to chart" });
    }

    const labels = chData.data.map((row) => row[keys[0]]);
    const values = chData.data.map((row) => row[keys[1]]);

    const chartPayload = {
      type: "bar", // default, frontend can switch based on `action`
      data: {
        labels,
        datasets: [
          {
            label: keys[1],
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: action.replace(/_/g, " ") },
        },
      },
    };

    res.json(chartPayload);
  } catch (err) {
    console.error("Chart generation error:", err);
    res.status(500).json({ error: "Failed to generate chart" });
  }
});

function makeAuthHeader() {
  return "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64");
}

app.post("/chart", async (req, res) => {
  const { chartType, db, table, xAxis, yAxis, aggregation } = req.body;

  if (
    !db ||
    !table ||
    !xAxis ||
    (["scatter"].indexOf(chartType) < 0 && !yAxis)
  ) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // Build a ClickHouse SQL
  let sql;
  switch (chartType) {
    case "Scatter Plot":
      sql = `SELECT ${xAxis}, ${yAxis} FROM ${db}.${table} LIMIT 1000`;
      break;
    case "Heatmap":
      sql = `SELECT ${xAxis}, ${yAxis}, ${aggregation}(${yAxis}) AS value
             FROM ${db}.${table}
             GROUP BY ${xAxis}, ${yAxis}`;
      break;
    default:
      // Histogram, Bar Chart, Pie, Line, Radar, Box Plot → group by xAxis
      // use either count() or aggregation
      const aggFn =
        aggregation || (chartType === "Histogram" ? "count" : "avg");
      const col = chartType === "Pie Chart" ? yAxis : yAxis;
      sql = `SELECT ${xAxis} AS label, ${aggFn}(${col}) AS value
             FROM ${db}.${table}
             GROUP BY ${xAxis}
             ORDER BY ${xAxis}`;
  }

  try {
    const chRes = await fetch(`http://localhost:8123/`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: makeAuthHeader(),
      },
      body: sql,
    });
    const text = await chRes.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return res.status(500).json({ error: "No data" });

    // parse header vs rows
    const header = lines[0].split("\t");
    const rows = lines.slice(1).map((r) => r.split("\t"));

    let config = { type: "bar", data: {}, options: {} };

    switch (chartType) {
      case "Histogram":
      case "Bar Chart":
        config.type = "bar";
        config.data.labels = rows.map((r) => r[0]);
        config.data.datasets = [
          {
            label: `${chartType} of ${yAxis} by ${xAxis}`,
            data: rows.map((r) => Number(r[1])),
          },
        ];
        break;

      case "Pie Chart":
        config.type = "pie";
        config.data.labels = rows.map((r) => r[0]);
        config.data.datasets = [
          {
            data: rows.map((r) => Number(r[1])),
          },
        ];
        break;

      case "Line Chart":
        config.type = "line";
        config.data.labels = rows.map((r) => r[0]);
        config.data.datasets = [
          {
            label: `${yAxis}`,
            data: rows.map((r) => Number(r[1])),
            fill: false,
          },
        ];
        break;

      case "Scatter Plot":
        config.type = "scatter";
        config.data.datasets = [
          {
            label: `${yAxis} vs ${xAxis}`,
            data: rows.map((r) => ({ x: Number(r[0]), y: Number(r[1]) })),
          },
        ];
        break;

      case "Bubble Map":
        // Chart.js doesn’t have native heatmap: you’d need a plugin.
        // Here we fallback to a bubble chart to approximate
        config.type = "bubble";
        config.data.datasets = [
          {
            label: aggregation,
            data: rows.map((r) => ({ x: r[0], y: r[1], r: Number(r[2]) })),
          },
        ];
        break;

      case "Radar Chart":
        config.type = "radar";
        config.data.labels = rows.map((r) => r[0]);
        config.data.datasets = [
          {
            label: yAxis,
            data: rows.map((r) => Number(r[1])),
          },
        ];
        break;

      case "Box Plot":
        // Chart.js needs a plugin for box plots; skip here
        return res.status(501).json({ error: "Box Plot not supported" });

      default:
        return res.status(400).json({ error: "Unknown chartType" });
    }

    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/param", async (req, res) => {
  const { db, table, blocks, limit } = req.body;
  if (!db || !table) {
    return res.status(400).json({ error: "Missing db or table" });
  }

  // build SQL parts
  let selectParts = [];
  let groupByCols = [];
  let orderBy = "";
  let whereClauses = [];

  // check for explicit Select Columns block first
  const selectBlock = blocks.find((b) => b.type === "Select Columns");
  if (
    selectBlock &&
    Array.isArray(selectBlock.columns) &&
    selectBlock.columns.length
  ) {
    selectParts = selectBlock.columns;
  }

  // process other blocks
  blocks.forEach((b) => {
    switch (b.type) {
      case "Filter":
        whereClauses.push(`${b.column} = '${b.value}'`);
        break;
      case "Group By":
        // if user grouped without explicit select, add to selectParts
        groupByCols.push(b.column);
        if (!selectBlock) selectParts.push(b.column);
        break;
      case "Aggregate":
        const alias = `${b.func.toLowerCase()}_${b.column}`;
        selectParts.push(`${b.func}(${b.column}) AS ${alias}`);
        break;
      case "Sort By":
        orderBy = `ORDER BY ${b.column} ${b.order}`;
        break;
      case "Date Range":
        if (b.column && b.start && b.end) {
          whereClauses.push(
            `${b.column} BETWEEN toDateTime('${b.start}') AND toDateTime('${b.end}')`
          );
        }
        break;
    }
  });

  // fallback to * only if nothing selected or grouped or aggregated
  if (selectParts.length === 0) {
    selectParts = ["*"];
  }

  // assemble SQL
  let sql = `SELECT ${selectParts.join(", ")} FROM ${db}.${table}`;
  if (whereClauses.length) {
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }
  if (groupByCols.length) {
    sql += ` GROUP BY ${groupByCols.join(", ")}`;
  }
  if (orderBy) {
    sql += ` ${orderBy}`;
  }
  sql += ` LIMIT ${limit}`;
  sql += ` FORMAT TabSeparatedWithNames`;

  console.log("Generated SQL:", sql);

  try {
    const response = await fetch("http://localhost:8123/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization:
          "Basic " + Buffer.from(`${CH_USER}:${CH_PASS}`).toString("base64"),
      },
      body: sql,
    });
    const data = await response.text();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
