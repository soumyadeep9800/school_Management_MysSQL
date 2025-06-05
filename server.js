import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});
console.log("MySQL Connected Successfully");
// await db.execute(`create database school_management`);
// console.log(await db.execute('show databases'));

// await db.execute(`
//     CREATE TABLE IF NOT EXISTS schools (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     name VARCHAR(255) NOT NULL,
//     address VARCHAR(255) NOT NULL,
//     latitude FLOAT NOT NULL,
//     longitude FLOAT NOT NULL
//     )
// `);
// console.log("Schools table created successfully");

app.get('/', (req, res) => {
    res.send('Welcome to my School');
});

//add school
app.post('/addSchool', async (req,res)=>{
    const {name,address,latitude,longitude}= req.body;

    if(!name || !address || typeof latitude !== 'number' || typeof longitude !== 'number'){
        return res.status(400).json({error: "Invalid input. all fields are required."});
    }

    try {
        const [existing] = await db.execute(
            'SELECT * FROM schools WHERE name = ? AND address = ?',
            [name, address]
        );

        if(existing.length > 0){
            return res.status(409).json({error: "School already exists with the same name and address."});
        }
        
        const [result]=await db.execute(
            'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
            [name,address,latitude,longitude]
        );
        res.status(200).json({message: 'school added succesfully', schoolID: result.insertId});
    } catch (error) {
        console.error('Insert Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
//list of school
app.get('/listSchools', async (req,res)=>{
    const {latitude, longitude}=req.query;

    if(!latitude || !longitude || isNaN(latitude) || isNaN(longitude)){
        return res.status(400).json({error: "Invalid or missing latitude/longitude"});
    }
    
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    try {
        const [schools] = await db.execute('SELECT * FROM schools');
        //Haversine
        const toRad = (value) => (value * Math.PI) / 180;
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
        };
        const schoolsWithDistance = schools.map(school => {
        const distance = calculateDistance(userLat, userLon, school.latitude, school.longitude);
        return { ...school, distance: parseFloat(distance.toFixed(2)) };
        });

        const sortedSchools = schoolsWithDistance.sort((a, b) => a.distance - b.distance);
        res.json(sortedSchools);
    } catch (error) {
        console.error('Query Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
