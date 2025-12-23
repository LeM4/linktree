import { db } from "./lib/db.js";

function seedDb() {
    const links = [
        { title: 'My Website', url: 'https://www.example.com', blocked_countries: '[]', enabled: true, order_index: 1 },
        { title: 'My Twitter', url: 'https://www.twitter.com/example', blocked_countries: '[]', enabled: true, order_index: 2 },
        { title: 'My GitHub', url: 'https://www.github.com/example', blocked_countries: '["US"]', enabled: true, order_index: 3 },
        { title: 'Disabled Link', url: 'https://www.example.com/disabled', blocked_countries: '[]', enabled: false, order_index: 4 },
    ];

    const stmt = db.prepare("INSERT INTO links (title, url, blocked_countries, enabled, order_index) VALUES (?, ?, ?, ?, ?)");

    for (const link of links) {
        stmt.run(link.title, link.url, link.blocked_countries, link.enabled, link.order_index);
    }
}

console.log('Seeding database...');
seedDb();
console.log('Database seeded.');
