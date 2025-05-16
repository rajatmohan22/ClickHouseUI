let tableData = [];
    let header = [];

    const form = document.getElementById("queryForm");

    form.addEventListener("submit", async function(e) {
      e.preventDefault();

      const query = document.getElementById("queryBox").value;
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      const text = await response.text();
      const resultTable = document.getElementById("resultTable");
      const dropdownContainer = document.getElementById("filterDropdownContainer");

      if (!text.trim()) {
        resultTable.innerHTML = `<p>0 rows returned</p>`;
        dropdownContainer.style.display = "none";
        return;
      }

      const lines = text.trim().split('\n');
      header = lines[0]?.split('\t') || [];
      tableData = lines.slice(1).map(row => row.split('\t'));

      renderTable(header, tableData);

      // Show filter dropdown if there are at least 1 data row
      if (tableData.length >= 1) {
        dropdownContainer.style.display = "block";
        updateDropdown(header);
      } else {
        dropdownContainer.style.display = "none";
      }
    });

    function renderTable(header, rows) {
      const resultTable = document.getElementById("resultTable");
      let table = `<p>${rows.length} rows returned</p>`;
      table += `<table class="table table-bordered table-striped"><thead><tr>`;
      header.forEach(h => { table += `<th>${h}</th>`; });
      table += `</tr></thead><tbody>`;
      rows.forEach(row => {
        table += `<tr>`;
        row.forEach(cell => { table += `<td>${cell}</td>`; });
        table += `</tr>`;
      });
      table += `</tbody></table>`;
      resultTable.innerHTML = table;
    }

    function updateDropdown(headers) {
      const columnFilter = document.getElementById("columnFilter");
      columnFilter.innerHTML = `<option value="">-- Select Column --</option>`;
      headers.forEach((col, index) => {
        columnFilter.innerHTML += `<option value="${index}">${col}</option>`;
      });
    }

    document.getElementById("applySort").addEventListener("click", () => {
      const colIndex = document.getElementById("columnFilter").value;
      const order = document.getElementById("sortOrder").value;

      if (colIndex === "") return;

      const sorted = [...tableData].sort((a, b) => {
        const valA = a[colIndex];
        const valB = b[colIndex];
        if (!isNaN(valA) && !isNaN(valB)) {
          return order === "asc" ? valA - valB : valB - valA;
        }
        return order === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });

      renderTable(header, sorted);
    });