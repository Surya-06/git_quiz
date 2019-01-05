var express = require('express'),
    app = express(),
    session = require('express-session');

var config = require('./config.json');

app.use ( session({
    secret : "secret-key"
}));

app.get ( '/' , (req,res) => {
    if ( req.session.visited ){
        res.sendStatus ( 401 );
    }
    else {
        req.session.visited = true ;
        if ( req.param.username == config.admin.username && req.param.password == config.admin.password ){
            // redirect to input page 

        }
        else {
            // redirect to test page 
        }
    }
});

app.listen ( 3000 );