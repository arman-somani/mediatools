const fs = require('fs');

let nb = JSON.parse(fs.readFileSync('Colab-Server.ipynb', 'utf8'));

// Find the cell with the pre-harvest logic
let cell = nb.cells.find(c => c.source.join('').includes('pre_harvest.js') || c.source.join('').includes('Harvesting fresh cookies now'));

if (cell) {
  // Revert the cell to just the standard startup
  cell.source = [
    "# Start the Node.js backend server\n",
    "print(\"\\n📜 STREAMING LIVE SERVER LOGS BELOW...\")\n",
    "print(\"-\"*60)\n",
    "!npm start\n"
  ];

  fs.writeFileSync('Colab-Server.ipynb', JSON.stringify(nb, null, 2));
  console.log('Notebook reverted to instant boot successfully');
} else {
  console.log('Could not find the cell to update');
}
