

//Loading Variables
require('dotenv').load();

const express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    http = require('http').Server(app),
    mongoose = require('mongoose'),
    btoa = require('btoa'),
    atob = require('atob'),
    mongoURI = process.env.mongoURI,
    port = process.env.PORT || 80,
    timestamps = require('mongoose-timestamp'),
    randomize = require('randomatic');

// ExpressJS server start
http.listen(port, function () {
    console.log('Server Started. Listening port:' + port);
});

// ExpressJS middleware for serving static files
app.use(express.static('public'));

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// Base route for front-end
app.get('/', function (req, res) {
    res.sendFile('views/index.html', {
        root: __dirname
    });
});

// Counter Collection Schema
let countersSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    count: { type: Number, default: 0 }
});

countersSchema.plugin(timestamps);

let counterModel = mongoose.model('Counter', countersSchema);

// URL Collection Schema
let urlSchema = new mongoose.Schema({
    _id: { type: Number },
    url: '',
    hash: { type : String }
});

urlSchema.plugin(timestamps);

// URL Schema pre-save step
//
// This is run BEFORE a new document is persisted in the URL collection. All
// we are doing here is incrementing the counter in the Counter collection which
// then becomes the unique ID for the new document to be inserted in the URL
// collection
urlSchema.pre('save', async (next) => {
    console.log('APP: Running pre-save');

    let counter = await counterModel.findByIdAndUpdate({ _id: 'url_count' }, { $inc: { count: 1 } });

    console.log(counter);

    if (!counter) {
        await new counterModel({ _id: 'url_count', count: 1 }).save();
    }

    next();
});

let URL = mongoose.model('URL', urlSchema);

// WARNING: Do this only when you want a fresh instance of the application else
// comment the code.

let creatingConnection = () => {
    const dbURI = mongoURI;
    // make connection with mongodb
    if (!mongoose.connection.readyState) {
        mongoose.connect(dbURI);
    } else {
        console.log('Connection Unsuccessfull');
    }

    // when successfully connected
    mongoose.connection.on('connected', () => {
        console.log('mongoose connection open to ' + dbURI);
        return;
    });

    // if the connection throws an error
    mongoose.connection.on('error', err => {
        console.log(err);
        return;
    });

    // when the connection is disconnected
    mongoose.connection.on('disconnected', () => {
        console.log('mongoose connection disconnected');
        return;
    });
}

creatingConnection();

// API for redirection
app.get('/:hash', async (req, res) => {
    try {
        const baseid = req.params.hash;
        if (baseid) {
            console.log('APP: Hash received: ' + baseid);
            const id = baseid;
            console.log('APP: Decoding Hash: ' + baseid);
            let doc = await URL.findOne({ hash: id });

            if (doc) {
                console.log('APP: Found ID in DB, redirecting to URL');
                console.log(doc.url);
                res.redirect(doc.url);
            } else {
                console.log('APP: Could not find ID in DB, redirecting to home');
                res.redirect('/');
            }
        } else {
            console.log('APP: Could not find ID');
        }
    } catch (err) {
        console.log(err);
        console.log('APP: There was error processing request');
        res.status(500);
        res.json({
            success: 0,
            message: 'APP: There was error processing request',
            data: {}
        });
    }
});

// API for shortening
app.post('/shorten', async (req, res, next) => {
    try {
        const urlData = req.body.url;

        const doc = await URL.findOne({ url: urlData }),
              lengthOFDocs = await URL.count();

        if (doc) {
            console.log('APP: URL found in DB');
            res.send({
                url: urlData  || '',
                hash: doc.hash,
                status: 200,
                statusTxt: 'OK'
            });
        } else {
            console.log('APP: URL not found in DB, creating new document');
            var url = new URL({
                _id: lengthOFDocs,
                url: urlData
            });

            let saveUrl = await url.save(),
                randomString = randomize('Aa0', 5) + saveUrl._id;
                saveUrl.hash = randomString;
                saveUrl.save();

            res.send({
                url: urlData,
                hash: saveUrl.hash,
                status: 200,
                statusTxt: 'OK'
            });
        }
    } catch (err) {
        console.log(err);
        console.log('APP: There was error processing request');
        res.status(500);
        res.json({
            success: 0,
            message: 'APP: There was error processing request',
            data: {}
        });
    }
});
