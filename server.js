var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
db = require('./db')(); //global hack
moviedb = require('./moviedb')();
var jwt = require('jsonwebtoken');

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObject(req) {
    var json = {
        headers : "No Headers",
        key: process.env.UNIQUE_KEY,
        body : "No Body"
    };

    if (req.body != null) {
        json.body = req.body;
    }
    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.route('/signup')
    .all(function(req, res, next) {
        if(req.method !== 'POST'){
            res.status(501).send({success: false, msg: req.method + ' - HTTP method not supported'});
        } else {
            console.log(req.method + " Accepted");
            next();
        }
    })
    .post(function(req, res, next){
        if (!req.body.username || !req.body.password) {
            res.json({success: false, msg: 'Please pass username and password.'});
        } else {
            var newUser = {
                username: req.body.username,
                password: req.body.password
            };
            // save the user
            db.save(newUser); //no duplicate checking
            res.json({success: true, msg: 'Successful created new user.'});
        }
        next();
    });

router.route('/signin')
    .all(function(req, res, next){
        if (req.method !== 'POST'){
            res.status(501).send({success: false, msg: req.method + ' - HTTP method not supported'});
        } else {
            console.log(req.method + " Accepted");
            next();
        }
    })
    .post(function(req, res, next) {
        var user = db.findOne(req.body.username);

        if (!user) {
            res.status(401).send({success: false, msg: 'Authentication failed. User not found.'});
        }
        else {
            // check if password matches
            if (req.body.password === user.password)  {
                var userToken = { id : user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.UNIQUE_KEY);
                res.json({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed. Wrong password.'});
            }
        }
        next();
    });

router.route('/movies')
    .all(function(req, res, next){
        if(req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
            console.log(req.method + " Accepted");
            next();
        } else {
            res.status(501).send({success: false, msg: req.method + ' - HTTP method not supported'});
        }
    })
    .get(function(req, res){
        let headers = getJSONObject(req);
        headers.env = process.env.UNIQUE_KEY;

        let movies = moviedb.find();

        let json = {
            status: 200,
            message: 'GET movies',
            headers: headers,
            movies: movies
        };

        res.status(200).send(json)
    })
    .post(function(req, res){
        let headers = getJSONObject(req);
        headers.env = process.env.UNIQUE_KEY;

        // Test if input good!
        if (!req.body.title || !req.body.year) {
            res.status(400).send({success: false, msg: 'Please pass title and year.'});
        } else {
            let newMovie = {
                title: req.body.title,
                year: req.body.year
            };
            // save the movie
            moviedb.save(newMovie); //no duplicate checking

            let json = {
                status: 200,
                message: "POST movies",
                headers: headers,
                msg: 'Successfully created new movie'
            };

            res.status(200).send(json);
        }
    })
    .put(authJwtController.isAuthenticated, function(req, res) {
        let headers = getJSONObject(req);
        headers.env = process.env.UNIQUE_KEY;

        let json = {
            status: 200,
            message: 'movie updated',
            headers: headers,
        };

        if(!req.body.oldtitle || !req.body.newtitle || !req.body.newyear) {
           json.success = false;
           json.message = 'Please send both the title and year of the both the movie to update,' +
                            ' and the movie with updated info!';
           json.status = 400;
        } else {
            let newMovie = {
                title: req.body.newtitle,
                year: req.body.newyear
            };
            let success = moviedb.update(req.body.oldtitle, newMovie);
            if(success === 1){
                json.success = true;
                json.status = 200;
            } else {
                json.success = false;
                json.message = `No movies found with title ${req.oldtitle}!`;
                json.status = 400;
            }
            res.status(json.status).send(json);
        }
    })
    .delete(authController.isAuthenticated, function(req, res) {
        let headers = getJSONObject(req);
        headers.env = process.env.UNIQUE_KEY;

        let json = {
            status: 200,
            message: "movie deleted",
            headers: headers
        };

        if(!req.body.title || !req.body.year) {
            json.success = false;
            json.status = 400;
            json.message = 'Please send movie to be deleted ie {movie: {title: , year: }}'
        } else {

            let success = moviedb.remove(req.body.title);

            if(success === 0) {
                json.message = 'Movie not found';
                json.status = 400;
                json.success = false;
            }
        }
        res.status(json.status).send(json);
    });
app.use('/', router);
app.listen(process.env.PORT || 8080);

module.exports = app; // for testing