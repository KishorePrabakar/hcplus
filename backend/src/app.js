const express = require('express');
const app = express();

app.use(express.json());

const port = 3000;

app.get('/', (req, res)=>{
    res.send("Hello World");
})

app.get('/health', (req, res) =>{
    res.json({
        "status":"ok"
    })
});

app.listen(port, ()=>{
    console.log(`The server is running in localhost:${port}/`);
})

