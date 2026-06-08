const db = require('./database');

const command = process.argv[2];
const username = process.argv[3];
const amount = parseFloat(process.argv[4]);

if (!command || !username) {
    console.log('Usage: node admin.js [add-gems|remove-gems|set-role] [username] [amount/role]');
    process.exit(1);
}

if (command === 'add-gems') {
    if (isNaN(amount)) {
        console.log('Please provide a valid amount.');
        process.exit(1);
    }
    db.run('UPDATE users SET gems = gems + ? WHERE username = ? OR steamid = ?', [amount, username, username], function(err) {
        if (err) return console.error(err);
        if (this.changes === 0) return console.log('User not found.');
        console.log(`Added ${amount} gems to ${username}.`);
        db.close();
    });
} else if (command === 'remove-gems') {
    if (isNaN(amount)) {
        console.log('Please provide a valid amount.');
        process.exit(1);
    }
    db.run('UPDATE users SET gems = MAX(0, gems - ?) WHERE username = ? OR steamid = ?', [amount, username, username], function(err) {
        if (err) return console.error(err);
        if (this.changes === 0) return console.log('User not found.');
        console.log(`Removed ${amount} gems from ${username}.`);
        db.close();
    });
} else {
    console.log('Unknown command');
    process.exit(1);
}
