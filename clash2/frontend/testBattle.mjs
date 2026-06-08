import { io } from 'socket.io-client';

async function test() {
    const username = 'testuser_' + Date.now();
    const password = 'password123';
    
    console.log("Registering user:", username);
    const regRes = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const regData = await regRes.json();
    if (regData.error) {
        console.error("Registration error:", regData.error);
        return;
    }
    const token = regData.token;
    console.log("Registered successfully. Token acquired. Gems:", regData.gems);

    console.log("Connecting socket...");
    const socket = io('http://localhost:3001', {
        auth: { token }
    });

    socket.on('connect', async () => {
        console.log("Socket connected! Listening for game feed...");
        
        socket.on('game_feed_update', (update) => {
            console.log("\n>>> RECEIVED game_feed_update:");
            console.log(update);
            console.log("Type of profit:", typeof update.profit);
            console.log("Is profit >= 0?", update.profit >= 0);
            socket.disconnect();
            process.exit(0);
        });

        // 3. Create a Solo Case Battle
        // We need caseIds. Let's use Case 19 (Mines, price 20)
        console.log("Creating solo battle with case 19...");
        socket.emit('create_battle', {
            caseIds: [19],
            mode: 'solo',
            isCrazyMode: false,
            isMythicSpin: false
        }, (res) => {
            if (res.error) {
                console.error("Battle creation error:", res.error);
                socket.disconnect();
                process.exit(1);
            }
            console.log("Battle created successfully. Battle ID:", res.battleId);
        });
    });
}

test().catch(console.error);
