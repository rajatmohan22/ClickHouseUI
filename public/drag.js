const sendQueryToBackend = async (query) => {
  try {
    const res = await fetch("/drag", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const text = await res.text();
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = "";

    if (!res.ok) {
      outputDiv.innerHTML = `<div class="text-danger">Error: ${res.statusText}</div>`;
      return;
    }

    try {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        const table = document.createElement("table");
        table.className = "table table-sm table-bordered";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        Object.keys(data[0]).forEach((key) => {
          const th = document.createElement("th");
          th.textContent = key;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        data.forEach((row) => {
          const tr = document.createElement("tr");
          Object.values(row).forEach((val) => {
            const td = document.createElement("td");
            td.textContent = val;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        outputDiv.appendChild(table);
      } else {
        outputDiv.innerHTML = `<div class="text-muted">Query successful, but no data returned.</div>`;
      }
    } catch {
      outputDiv.innerHTML = `<pre>${text}</pre>`;
    }
  } catch (err) {
    document.getElementById(
      "output"
    ).innerHTML = `<div class="text-danger">Request failed: ${err.message}</div>`;
  }
};

document.querySelectorAll('[draggable="true"]').forEach((el) => {
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("component", e.target.dataset.type);
  });
});

const canvas = document.getElementById("canvas");
const undoStack = [];

canvas.addEventListener("dragover", (e) => e.preventDefault());
canvas.addEventListener("drop", async (e) => {
  e.preventDefault();
  const type = e.dataTransfer.getData("component");
  const wrapper = document.createElement("div");
  wrapper.className = "p-3 mb-3 border rounded position-relative";

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "✕";
  deleteBtn.className = "btn-close position-absolute top-0 end-0 m-2";
  deleteBtn.onclick = () => wrapper.remove();
  wrapper.appendChild(deleteBtn);

  if (type === "create") {
    const title = document.createElement("h5");
    title.textContent = "Create Object";
    wrapper.appendChild(title);

    const kind = document.createElement("select");
    kind.className = "form-select mb-2";
    ["Database", "Table", "View", "Materialized View"].forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      kind.appendChild(option);
    });
    wrapper.appendChild(kind);

    const dynamicArea = document.createElement("div");
    wrapper.appendChild(dynamicArea);

    kind.addEventListener("change", () => renderForm(kind.value));
    renderForm(kind.value);

    async function renderForm(type) {
      dynamicArea.innerHTML = "";
      const nameInput = document.createElement("input");
      nameInput.className = "form-control mb-2";
      nameInput.placeholder = `${type} Name`;
      dynamicArea.appendChild(nameInput);

      if (type === "Table") {
        const dbInput = document.createElement("input");
        dbInput.className = "form-control mb-2";
        dbInput.placeholder = "Database Name";
        dynamicArea.appendChild(dbInput);

        const engineInput = document.createElement("input");
        engineInput.className = "form-control mb-2";
        engineInput.placeholder = "Engine (default: MergeTree)";
        dynamicArea.appendChild(engineInput);

        const orderByInput = document.createElement("input");
        orderByInput.className = "form-control mb-2";
        orderByInput.placeholder = "ORDER BY (default: tuple())";
        dynamicArea.appendChild(orderByInput);

        const attrContainer = document.createElement("div");
        attrContainer.className = "mb-2";
        dynamicArea.appendChild(attrContainer);

        const addRow = () => {
          const row = document.createElement("div");
          row.className = "d-flex gap-2 mb-2";

          const attr = document.createElement("input");
          attr.placeholder = "Column Name";
          attr.className = "form-control";

          const typeSelect = document.createElement("select");
          typeSelect.className = "form-select";
          [
            "UInt32",
            "String",
            "Int64",
            "Float32",
            "Date",
            "DateTime",
            "UUID",
          ].forEach((dt) => {
            const opt = document.createElement("option");
            opt.value = dt;
            opt.textContent = dt;
            typeSelect.appendChild(opt);
          });

          row.appendChild(attr);
          row.appendChild(typeSelect);
          attrContainer.appendChild(row);
        };

        addRow();

        const addBtn = document.createElement("button");
        addBtn.textContent = "+ Add Column";
        addBtn.className = "btn btn-sm btn-outline-secondary mb-2";
        addBtn.onclick = addRow;
        dynamicArea.appendChild(addBtn);

        const runBtn = document.createElement("button");
        runBtn.textContent = "Create Table";
        runBtn.className = "btn btn-sm btn-outline-success mb-2";
        runBtn.onclick = (e) => {
          e.preventDefault();
          const table = nameInput.value.trim();
          const db = dbInput.value.trim();
          const engine = engineInput.value.trim() || "MergeTree";
          const orderBy = orderByInput.value.trim() || "tuple()";
          if (!table || !db) return alert("Missing table or db name");

          const columns = Array.from(attrContainer.children)
            .map((row) => {
              const inputs = row.querySelectorAll("input, select");
              const colName = inputs[0].value.trim();
              const colType = inputs[1].value.trim();
              return colName && colType ? `${colName} ${colType}` : null;
            })
            .filter(Boolean);

          if (!columns.length) return alert("Add columns");

          const query = `CREATE TABLE ${db}.${table} (${columns.join(
            ", "
          )}) ENGINE = ${engine} ORDER BY ${orderBy}`;
          sendQueryToBackend(query);
        };
        dynamicArea.appendChild(runBtn);

        // const insertSection = document.createElement("div");
        // insertSection.className = "mt-3";
        // insertSection.innerHTML = `<strong>Insert Rows</strong>`;

        // const rowInput = document.createElement("textarea");
        // rowInput.className = "form-control mb-2";
        // rowInput.placeholder = "Insert values (e.g., (1, 'John'), (2, 'Doe'))";
        // insertSection.appendChild(rowInput);

        // const insertBtn = document.createElement("button");
        // insertBtn.textContent = "Insert Rows";
        // insertBtn.className = "btn btn-sm btn-outline-primary mb-2";
        // insertBtn.onclick = () => {
        //   const values = rowInput.value.trim();
        //   const table = nameInput.value.trim();
        //   const db = dbInput.value.trim();
        //   if (!values || !table || !db) return alert("Missing data");
        //   const query = `INSERT INTO ${db}.${table} VALUES ${values}`;
        //   sendQueryToBackend(query);
        // };
        // insertSection.appendChild(insertBtn);
        // dynamicArea.appendChild(insertSection);
      }
      if (type === "Database") {
        const runBtn = document.createElement("button");
        runBtn.textContent = "Create Database";
        runBtn.className = "btn btn-sm btn-outline-success";
        runBtn.onclick = async (e) => {
          e.preventDefault();
          const dbName = nameInput.value.trim();
          if (!dbName) return alert("Missing database name");
          const query = `CREATE DATABASE ${dbName}`;
          await sendQueryToBackend(query);
          const msg = document.createElement("div");
          msg.className = "alert alert-success mt-2";
          msg.textContent = `Database '${dbName}' created successfully.`;
          dynamicArea.appendChild(msg);
        };
        dynamicArea.appendChild(runBtn);
      } else if (type === "View" || type === "Materialized View") {
        const queryInput = document.createElement("textarea");
        queryInput.className = "form-control mb-2";
        queryInput.placeholder = "SELECT query for view";
        dynamicArea.appendChild(queryInput);

        const runBtn = document.createElement("button");
        runBtn.textContent = "Run";
        runBtn.className = "btn btn-sm btn-outline-success";
        runBtn.onclick = (e) => {
          e.preventDefault();
          const view = nameInput.value.trim();
          const queryBody = queryInput.value.trim();
          if (!view || !queryBody) return alert("Missing fields");
          const query = `CREATE ${type.toUpperCase()} ${view} AS ${queryBody}`;
          sendQueryToBackend(query);
        };
        dynamicArea.appendChild(runBtn);
      }
    }
  } else if (type === "insert") {
    // 1) Title
    const title = document.createElement("h5");
    title.textContent = "Insert Rows";
    wrapper.appendChild(title);

    // 2) Database selector
    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    wrapper.appendChild(dbSelect);

    // 3) Table selector (disabled until a DB is picked)
    const tableSelect = document.createElement("select");
    tableSelect.className = "form-select mb-2";
    tableSelect.disabled = true;
    wrapper.appendChild(tableSelect);

    // 4) JSON input (disabled until table is picked)
    const jsonArea = document.createElement("textarea");
    jsonArea.className = "form-control mb-2";
    jsonArea.placeholder = `[{"col1":1,"col2":"foo"}, {"col1":2,"col2":"bar"}]`;
    jsonArea.disabled = true;
    wrapper.appendChild(jsonArea);

    // 5) Insert button (also disabled)
    const insertBtn = document.createElement("button");
    insertBtn.textContent = "Insert Rows";
    insertBtn.className = "btn btn-sm btn-outline-success";
    insertBtn.disabled = true;
    wrapper.appendChild(insertBtn);

    // --- fetch list of databases ---
    // --- fetch list of databases with async/await ---
    // --- fetch list of databases with async/await + error handling ---
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" }),
      });

      if (!dbRes.ok) {
        // Server returned some text error (not JSON)
        const errText = await dbRes.text();
        console.error("listDatabases failed:", errText);
        return; // stop here
      }

      // Now safe to parse JSON
      const dbs = await dbRes.json();
      dbs.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("listDatabases failed:", err);
    }

    // when a database is selected, fetch its tables
    dbSelect.onchange = async () => {
      const db = dbSelect.value;
      tableSelect.innerHTML = ""; // clear previous options
      tableSelect.disabled = true;
      jsonArea.disabled = true;
      insertBtn.disabled = true;

      try {
        const tblRes = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listTables", database: db }),
        });

        console.log("tblRes", tblRes);
        const tables = await tblRes.json(); // e.g. ["users","orders",...]
        tables.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = opt.textContent = t;
          tableSelect.appendChild(opt);
        });
        if (tables.length) {
          tableSelect.disabled = false;
          jsonArea.disabled = false;
          insertBtn.disabled = false;
        }
      } catch (err) {
        console.error("listTables failed:", err);
      }
    };

    // on click, build INSERT query and send
    insertBtn.onclick = () => {
      let rows;
      try {
        rows = JSON.parse(jsonArea.value);
      } catch {
        return alert("Invalid JSON");
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return alert("Need at least one row");
      }

      const cols = Object.keys(rows[0]);
      const vals = rows
        .map(
          (r) =>
            "(" +
            cols
              .map((c) =>
                typeof r[c] === "string"
                  ? `'${r[c].replace(/'/g, "\\'")}'`
                  : r[c]
              )
              .join(",") +
            ")"
        )
        .join(",");

      const q = `INSERT INTO ${dbSelect.value}.${
        tableSelect.value
      } (${cols.join(",")}) VALUES ${vals}`;

      sendQueryToBackend(q);
    };
  } else if (type === "update") {
    const title = document.createElement("h5");
    title.textContent = "Update Rows";
    wrapper.appendChild(title);

    // Database selector
    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    wrapper.appendChild(dbSelect);
    // Table selector
    const tableSelect = document.createElement("select");
    tableSelect.className = "form-select mb-2";
    tableSelect.disabled = true;
    wrapper.appendChild(tableSelect);

    // Column, Value & WHERE inputs
    const columnInput = document.createElement("input");
    columnInput.className = "form-control mb-2";
    columnInput.placeholder = "Column to update";
    columnInput.disabled = true;
    wrapper.appendChild(columnInput);
    const valueInput = document.createElement("input");
    valueInput.className = "form-control mb-2";
    valueInput.placeholder = "New value";
    valueInput.disabled = true;
    wrapper.appendChild(valueInput);
    const whereInput = document.createElement("input");
    whereInput.className = "form-control mb-2";
    whereInput.placeholder = "WHERE condition";
    whereInput.disabled = true;
    wrapper.appendChild(whereInput);

    // Execute Update and Refresh buttons
    const updateBtn = document.createElement("button");
    updateBtn.textContent = "Execute Update";
    updateBtn.className = "btn btn-sm btn-outline-warning me-2";
    updateBtn.disabled = true;
    wrapper.appendChild(updateBtn);
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Refresh Table";
    refreshBtn.className = "btn btn-sm btn-outline-primary";
    refreshBtn.disabled = true;
    wrapper.appendChild(refreshBtn);

    // load databases
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" }),
      });
      const dbs = await dbRes.json();
      dbs.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch {}

    dbSelect.onchange = async () => {
      tableSelect.innerHTML = "";
      tableSelect.disabled = true;
      columnInput.disabled = true;
      valueInput.disabled = true;
      whereInput.disabled = true;
      updateBtn.disabled = true;
      refreshBtn.disabled = true;
      try {
        const tblRes = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "listTables",
            database: dbSelect.value,
          }),
        });
        const tables = await tblRes.json();
        tables.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t;
          opt.textContent = t;
          tableSelect.appendChild(opt);
        });
        if (tables.length) {
          tableSelect.disabled = false;
          columnInput.disabled = false;
          valueInput.disabled = false;
          whereInput.disabled = false;
          updateBtn.disabled = false;
          refreshBtn.disabled = false;

          // preview on table pick
          tableSelect.onchange = async () => {
            const previewSql = `SELECT * FROM ${dbSelect.value}.${tableSelect.value}`;
            await sendQueryToBackend(previewSql);
          };

          // attach refresh
          refreshBtn.onclick = async () => {
            const refreshSql = `SELECT * FROM ${dbSelect.value}.${tableSelect.value}`;
            await sendQueryToBackend(refreshSql);
          };
        }
      } catch {}
    };

    updateBtn.onclick = async () => {
      const sql = `ALTER TABLE ${dbSelect.value}.${tableSelect.value} UPDATE ${
        columnInput.value
      } = ${
        isNaN(valueInput.value) ? `'${valueInput.value}'` : valueInput.value
      } WHERE ${whereInput.value}`;
      await sendQueryToBackend(sql);
      // success message
      const outputDiv = document.getElementById("output");
      const msg = document.createElement("div");
      msg.className = "alert alert-warning mt-2";
      msg.textContent = `Successfully updated rows in ${dbSelect.value}.${tableSelect.value}.`;
      outputDiv.prepend(msg);
    };
  }

  // DELETE OBJECT
  else if (type === "delete") {
    const title = document.createElement("h5");
    title.textContent = "Delete Operations";
    wrapper.appendChild(title);

    // Mode selector: Rows, Table, Database, View
    const modeSelect = document.createElement("select");
    modeSelect.className = "form-select mb-2";
    ["Delete Rows", "Drop Table", "Drop Database", "Drop View"].forEach(
      (optText) => {
        const opt = document.createElement("option");
        opt.value = optText;
        opt.textContent = optText;
        modeSelect.appendChild(opt);
      }
    );
    wrapper.appendChild(modeSelect);

    // Database selector
    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    dbSelect.disabled = false;
    wrapper.appendChild(dbSelect);

    // Table/View selector
    const objSelect = document.createElement("select");
    objSelect.className = "form-select mb-2";
    objSelect.disabled = true;
    wrapper.appendChild(objSelect);

    // WHERE input for row deletion
    const whereInput = document.createElement("input");
    whereInput.className = "form-control mb-2";
    whereInput.placeholder = "WHERE condition";
    whereInput.disabled = true;
    wrapper.appendChild(whereInput);

    // Execute button
    const execBtn = document.createElement("button");
    execBtn.textContent = "Execute";
    execBtn.className = "btn btn-sm btn-outline-danger";
    execBtn.disabled = true;
    wrapper.appendChild(execBtn);

    // load databases
    let databases = [];
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" }),
      });
      databases = await dbRes.json();
      databases.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch {}

    modeSelect.onchange = () => {
      const mode = modeSelect.value;
      execBtn.disabled = false;
      objSelect.disabled = mode === "Drop Database";
      whereInput.disabled = mode !== "Delete Rows";
      objSelect.innerHTML = "";
      if (mode !== "Drop Database") {
        const action =
          mode === "Delete Rows" || mode === "Drop Table"
            ? "listTables"
            : "listViews";
        fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, database: dbSelect.value }),
        })
          .then((r) => r.json())
          .then((list) =>
            list.forEach((item) => {
              const o = document.createElement("option");
              o.value = item;
              o.textContent = item;
              objSelect.appendChild(o);
            })
          );
        objSelect.disabled = false;
      }
    };

    dbSelect.onchange = () => {
      modeSelect.onchange();
    };

    execBtn.onclick = async () => {
      const mode = modeSelect.value;
      let sql;
      if (mode === "Delete Rows") {
        sql = `ALTER TABLE ${dbSelect.value}.${objSelect.value} DELETE WHERE ${whereInput.value}`;
      } else if (mode === "Drop Table") {
        sql = `DROP TABLE ${dbSelect.value}.${objSelect.value}`;
      } else if (mode === "Drop Database") {
        sql = `DROP DATABASE ${dbSelect.value}`;
      } else {
        sql = `DROP VIEW ${dbSelect.value}.${objSelect.value}`;
      }
      await sendQueryToBackend(sql);
      const outputDiv = document.getElementById("output");
      const msg = document.createElement("div");
      msg.className = "alert alert-danger mt-2";
      msg.textContent = `Executed: ${mode}`;
      outputDiv.prepend(msg);
    };
  } else if (type === "read") {
    const title = document.createElement("h5");
    title.textContent = "Read Data";
    wrapper.appendChild(title);

    // Action selector (databases, tables, views, table data)
    const actionSelect = document.createElement("select");
    actionSelect.className = "form-select mb-2";
    ["List Databases", "List Tables", "List Views", "Fetch Table Data"].forEach(
      (optText) => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = optText;
        actionSelect.appendChild(opt);
      }
    );
    wrapper.appendChild(actionSelect);

    // Database selector
    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    dbSelect.disabled = true;
    wrapper.appendChild(dbSelect);

    // Table/View selector
    const objSelect = document.createElement("select");
    objSelect.className = "form-select mb-2";
    objSelect.disabled = true;
    wrapper.appendChild(objSelect);

    // Execute button
    const execBtn = document.createElement("button");
    execBtn.textContent = "Execute";
    execBtn.className = "btn btn-sm btn-outline-primary";
    execBtn.disabled = false;
    wrapper.appendChild(execBtn);

    // Load databases once
    let databases = [];
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" }),
      });
      databases = await dbRes.json();
      databases.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch {}

    actionSelect.onchange = () => {
      const choice = actionSelect.value;
      dbSelect.disabled = choice === "List Databases";
      objSelect.disabled = choice !== "Fetch Table Data";
      execBtn.disabled = false;
    };

    dbSelect.onchange = async () => {
      const choice = actionSelect.value;
      objSelect.innerHTML = "";
      if (
        choice === "List Tables" ||
        choice === "List Views" ||
        choice === "Fetch Table Data"
      ) {
        const act = choice === "List Tables" ? "listTables" : "listViews";
        // for data fetch, reuse listTables to populate
        const action = choice === "Fetch Table Data" ? "listTables" : act;
        const res = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: action, database: dbSelect.value }),
        });
        const list = await res.json();
        list.forEach((item) => {
          const opt = document.createElement("option");
          opt.value = opt.textContent = item;
          objSelect.appendChild(opt);
        });
      }
    };

    execBtn.onclick = async () => {
      let sql;
      const choice = actionSelect.value;
      if (choice === "List Databases") {
        sql = "SHOW DATABASES";
      } else if (choice === "List Tables") {
        sql = `SHOW TABLES FROM ${dbSelect.value}`;
      } else if (choice === "List Views") {
        sql = `SHOW VIEWS FROM ${dbSelect.value}`;
      } else {
        sql = `SELECT * FROM ${dbSelect.value}.${objSelect.value}`;
      }
      await sendQueryToBackend(sql);
    };
  }

  if (type === "barchart") {
    // Bar Chart builder
    const title = document.createElement("h5");
    title.textContent = "Bar Chart";
    wrapper.appendChild(title);

    // DB selector
    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    wrapper.appendChild(dbSelect);
    // Table selector
    const tableSelect = document.createElement("select");
    tableSelect.className = "form-select mb-2";
    tableSelect.disabled = true;
    wrapper.appendChild(tableSelect);
    // X axis selector
    const xSelect = document.createElement("select");
    xSelect.className = "form-select mb-2";
    xSelect.disabled = true;
    wrapper.appendChild(xSelect);
    // Y axis selector
    const ySelect = document.createElement("select");
    ySelect.className = "form-select mb-2";
    ySelect.disabled = true;
    wrapper.appendChild(ySelect);
    // Render button
    const renderBtn = document.createElement("button");
    renderBtn.textContent = "Render Chart";
    renderBtn.className = "btn btn-sm btn-outline-primary";
    renderBtn.disabled = true;
    wrapper.appendChild(renderBtn);
    // Canvas for Chart.js
    const chartCanvas = document.createElement("canvas");
    chartCanvas.className = "mt-3";
    wrapper.appendChild(chartCanvas);

    // Load databases
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" }),
      });
      const dbs = await dbRes.json();
      dbs.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch {}

    dbSelect.onchange = async () => {
      tableSelect.innerHTML = "";
      tableSelect.disabled = true;
      xSelect.innerHTML = "";
      xSelect.disabled = true;
      ySelect.innerHTML = "";
      ySelect.disabled = true;
      renderBtn.disabled = true;
      try {
        const tblRes = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "listTables",
            database: dbSelect.value,
          }),
        });
        const tables = await tblRes.json();
        tables.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t;
          opt.textContent = t;
          tableSelect.appendChild(opt);
        });
        if (tables.length) {
          tableSelect.disabled = false;
          // auto-trigger initial load
          tableSelect.selectedIndex = 0;
          tableSelect.onchange();
        }
      } catch {}
    };

    tableSelect.onchange = async () => {
      xSelect.innerHTML = "";
      ySelect.innerHTML = "";
      xSelect.disabled = true;
      ySelect.disabled = true;
      renderBtn.disabled = true;
      // fetch columns via JSON
      const qry = `SELECT * FROM ${dbSelect.value}.${tableSelect.value} LIMIT 1 FORMAT JSON`;
      try {
        const res = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: qry }),
        });
        const obj = JSON.parse(await res.text());
        const cols = obj.data?.length ? Object.keys(obj.data[0]) : [];
        cols.forEach((col) => {
          const optX = document.createElement("option");
          optX.value = col;
          optX.textContent = col;
          xSelect.appendChild(optX);
          const optY = document.createElement("option");
          optY.value = col;
          optY.textContent = col;
          ySelect.appendChild(optY);
        });
        if (cols.length) {
          xSelect.disabled = false;
          ySelect.disabled = false;
          renderBtn.disabled = false;
        }
      } catch {}
    };

    renderBtn.addEventListener("click", async () => {
      const sql = `SELECT ${xSelect.value}, ${ySelect.value} FROM ${dbSelect.value}.${tableSelect.value} FORMAT JSON`;
      try {
        const res = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql }),
        });
        const obj = JSON.parse(await res.text());
        const rows = obj.data || [];
        const labels = rows.map((r) => r[xSelect.value]);
        const values = rows.map((r) => Number(r[ySelect.value]));
        // clear previous chart
        if (chartCanvas.chart) chartCanvas.chart.destroy();
        chartCanvas.chart = new Chart(chartCanvas.getContext("2d"), {
          type: "bar",
          data: { labels, datasets: [{ label: ySelect.value, data: values }] },
          options: { responsive: true, scales: { y: { beginAtZero: true } } },
        });
      } catch (err) {
        console.error(err);
      }
    });
  } else if (type === "piechart") {
    const title = document.createElement("h5");
    title.textContent = "Pie Chart";
    wrapper.appendChild(title);

    // DB selector
    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    wrapper.appendChild(dbSelect);
    // Table selector
    const tableSelect = document.createElement("select");
    tableSelect.className = "form-select mb-2";
    tableSelect.disabled = true;
    wrapper.appendChild(tableSelect);
    // Label selector (categorical)
    const labelSelect = document.createElement("select");
    labelSelect.className = "form-select mb-2";
    labelSelect.disabled = true;
    wrapper.appendChild(labelSelect);
    // Value selector (numeric)
    const valueSelect = document.createElement("select");
    valueSelect.className = "form-select mb-2";
    valueSelect.disabled = true;
    wrapper.appendChild(valueSelect);
    // Render button
    const renderBtn = document.createElement("button");
    renderBtn.textContent = "Render Pie Chart";
    renderBtn.className = "btn btn-sm btn-outline-primary";
    renderBtn.disabled = true;
    wrapper.appendChild(renderBtn);

    const chartCanvas = document.createElement("canvas");
    chartCanvas.style.maxWidth = "500px"; // constrain size
    chartCanvas.style.maxHeight = "500px";
    chartCanvas.className = "mt-2";
    wrapper.appendChild(chartCanvas);
    // Canvas
    // const chartCanvas = document.createElement("canvas"); chartCanvas.className = "mt-3"; wrapper.appendChild(chartCanvas);

    // Load databases
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" }),
      });
      const dbs = await dbRes.json();
      dbs.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch {}

    dbSelect.onchange = async () => {
      tableSelect.innerHTML = "";
      tableSelect.disabled = true;
      labelSelect.innerHTML = "";
      labelSelect.disabled = true;
      valueSelect.innerHTML = "";
      valueSelect.disabled = true;
      renderBtn.disabled = true;
      try {
        const tblRes = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "listTables",
            database: dbSelect.value,
          }),
        });
        const tables = await tblRes.json();
        tables.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t;
          opt.textContent = t;
          tableSelect.appendChild(opt);
        });
        if (tables.length) {
          tableSelect.disabled = false;
          tableSelect.selectedIndex = 0;
          tableSelect.onchange();
        }
      } catch {}
    };

    tableSelect.onchange = async () => {
      labelSelect.innerHTML = "";
      valueSelect.innerHTML = "";
      labelSelect.disabled = true;
      valueSelect.disabled = true;
      renderBtn.disabled = true;
      const qry = `SELECT * FROM ${dbSelect.value}.${tableSelect.value} LIMIT 1 FORMAT JSON`;
      try {
        const res = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: qry }),
        });
        const obj = JSON.parse(await res.text());
        const cols = obj.data?.length ? Object.keys(obj.data[0]) : [];
        cols.forEach((col) => {
          const optL = document.createElement("option");
          optL.value = col;
          optL.textContent = col;
          labelSelect.appendChild(optL);
          const optV = document.createElement("option");
          optV.value = col;
          optV.textContent = col;
          valueSelect.appendChild(optV);
        });
        if (cols.length) {
          labelSelect.disabled = false;
          valueSelect.disabled = false;
          renderBtn.disabled = false;
        }
      } catch {}
    };

    renderBtn.onclick = async () => {
      const sql = `SELECT ${labelSelect.value}, ${valueSelect.value} FROM ${dbSelect.value}.${tableSelect.value} FORMAT JSON`;
      try {
        const res = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql }),
        });
        const obj = JSON.parse(await res.text());
        const rows = obj.data || [];
        const labels = rows.map((r) => r[labelSelect.value]);
        const values = rows.map((r) => Number(r[valueSelect.value]));
        if (chartCanvas.chart) chartCanvas.chart.destroy();
        chartCanvas.chart = new Chart(chartCanvas.getContext("2d"), {
          type: "pie",
          data: {
            labels,
            datasets: [{ data: values, label: valueSelect.value }],
          },
          options: { responsive: true },
        });
      } catch (err) {
        console.error(err);
      }
    };
  }

  canvas.appendChild(wrapper);
  undoStack.push(wrapper);
});

const undoBtn = document.getElementById("undo-btn");
const clearBtn = document.getElementById("clear-btn");

undoBtn.addEventListener("click", () => {
  const last = undoStack.pop();
  if (last && last.parentNode === canvas) {
    canvas.removeChild(last);
  }
});

clearBtn.addEventListener("click", () => {
  // Remove all dropped wrappers
  undoStack.forEach((node) => {
    if (node.parentNode === canvas) {
      canvas.removeChild(node);
    }
  });
  undoStack.length = 0;
  // Clear output
  document.getElementById("output").innerHTML = "";
});
