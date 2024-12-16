const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");

//const portNumber = Number(process.argv[2]);
const portNumber = process.env.PORT || 5001;


const app = express();

app.use('/styles.css', express.static(__dirname + '/styles.css'));

require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') });
const user = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const dbAndCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION };

const templatePath = path.resolve(__dirname, "templates");
app.use(express.static(templatePath));
app.set("view engine", "ejs");
app.set("views", templatePath);
app.use(bodyParser.urlencoded({ extended: true }));

const uri = `mongodb+srv://${user}:${password}@cluster0.fb4wh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

let client = new MongoClient(uri);
process.stdin.setEncoding("utf8");


app.listen(portNumber, () => {
    console.log(`WebServer started and running at http://localhost:${portNumber}`);
    process.stdout.write(prompt);
});

// let server = app.listen(portNumber, async () => {
//     console.log(`Web server started and running at http://localhost:${portNumber}`);
//     console.log(`Stop to shutdown the server: `);
//     await client.connect();
// });

// process.stdin.on("readable", () => {
//     const dataInput = process.stdin.read();
//     if (dataInput !== null) {
//         const instruction = dataInput.toString().trim().toLowerCase();
//         if (instruction === "stop") {
//             shutdownServer();
//         }
//     }
// });

// function shutdownServer() {
//     console.log("Shutting down the server");
//     server.close(() => {
//         client.close();
//         process.exit(0); 
//     });
// }


app.use((req, res, next) => {
    res.locals.error = null;
    next();
});

// Home page route
app.get("/", (req, res) => {
    res.render("index.ejs");
});

// Proxy route for PokeAPI
app.get("/api/pokemon/:query", async (req, res) => {
    const query = req.params.query;
    const apiUrl = `https://pokeapi.co/api/v2/pokemon/${query}`;

    try {
        // Axios request with timeout
        const response = await axios.get(apiUrl, { timeout: 5000 }); // 5 seconds timeout
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching data from PokeAPI:", error.message);
        res.status(error.response?.status || 500).send("Failed to fetch data from PokeAPI.");
    }
});



// Search Pokémon route using the proxy
app.post("/searchPokemon", async (req, res) => {
    const query = req.body.query;
    const isNumber = /^[0-9]+$/.test(query);

    if (!query || query.trim() === '') {
        return res.render("index.ejs", { error: 'Please enter a valid name or number.' });
    }

    const apiUrl = `/api/pokemon/${isNumber ? query : query.toLowerCase()}`;

    try {
        const response = await axios.get(`http://localhost:${portNumber}${apiUrl}`); // Local proxy call
        const pokemon = {
            name: response.data.name,
            id: response.data.id,
            image: response.data.sprites.front_default,
            types: response.data.types.map(t => t.type.name).join(', ')
        };

        await client.db(dbAndCollection.db).collection(dbAndCollection.collection).insertOne({
            query: query,
            name: pokemon.name,
            id: pokemon.id,
            date: new Date()
        });
        res.render("result.ejs", { pokemon });
    } catch (error) {
        console.error("Error calling proxy route:", error.message);
        res.render("index.ejs", { error: 'Pokemon not found. Please try again.' });
    }
});


// View search history route
app.get("/history", async (req, res) => {
    const history = await client.db(dbAndCollection.db).collection(dbAndCollection.collection).find({}).toArray();
    
    if (history.length === 0) {
        res.render("emptyHistory.ejs");
    } else {
        res.render("history.ejs", { history });
    }
});

// Clear search history route
app.post("/clearHistory", async (req, res) => {
    const result = await client.db(dbAndCollection.db).collection(dbAndCollection.collection).deleteMany({});
    res.render("clearHistory.ejs", { count: result.deletedCount });
});
