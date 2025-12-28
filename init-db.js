import { initDb, updateSettings } from "./lib/db.js";

console.log("Initializing database...");
initDb();
console.log("Database initialized.");

console.log("Inserting default settings...");
updateSettings('#f0f0f0', 'My Awesome Linktree', 'https://via.placeholder.com/150', 'Welcome to my page!');
console.log("Default settings inserted.");
