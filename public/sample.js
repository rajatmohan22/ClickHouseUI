else if (type === "update") {
    const title = document.createElement("h5");
    title.textContent = "Update Rows";
    wrapper.appendChild(title);

    const dbSelect = document.createElement("select");
    dbSelect.className = "form-select mb-2";
    wrapper.appendChild(dbSelect);
    const tableSelect = document.createElement("select");
    tableSelect.className = "form-select mb-2";
    tableSelect.disabled = true;
    wrapper.appendChild(tableSelect);

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

    const updateBtn = document.createElement("button");
    updateBtn.textContent = "Execute Update";
    updateBtn.className = "btn btn-sm btn-outline-warning";
    updateBtn.disabled = true;
    wrapper.appendChild(updateBtn);

    // load databases
    try {
      const dbRes = await fetch("/drag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDatabases" })
      });
      const dbs = await dbRes.json();
      dbs.forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.textContent = db;
        dbSelect.appendChild(opt);
      });
    } catch {}

    // when a database is selected, populate tables and preview on table change
    dbSelect.onchange = async () => {
      tableSelect.innerHTML = "";
      tableSelect.disabled = true;
      columnInput.disabled = true;
      valueInput.disabled = true;
      whereInput.disabled = true;
      updateBtn.disabled = true;
      try {
        const tblRes = await fetch("/drag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listTables", database: dbSelect.value })
        });
        const tables = await tblRes.json();
        tables.forEach(t => {
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

          // preview contents when a table is picked
          tableSelect.onchange = async () => {
            const previewSql = `SELECT * FROM ${dbSelect.value}.${tableSelect.value}`;
            await sendQueryToBackend(previewSql);
          };
        }
      } catch {}
    };

    // perform update
    updateBtn.onclick = async () => {
      const sql = `ALTER TABLE ${dbSelect.value}.${tableSelect.value} UPDATE ${columnInput.value} = ${isNaN(valueInput.value) ? `'${valueInput.value}'` : valueInput.value} WHERE ${whereInput.value}`;
      await sendQueryToBackend(sql);
      const outputDiv = document.getElementById("output");
      const msg = document.createElement("div");
      msg.className = "alert alert-warning mt-2";
      msg.textContent = `Updated rows in ${dbSelect.value}.${tableSelect.value}.`;
      outputDiv.prepend(msg);
      const updatedSQL = `SELECT * FROM ${dbSelect.value}.${tableSelect.value}`
      await sendQueryToBackend(updatedSQL)
    };

    


  }