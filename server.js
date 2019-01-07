const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const io = require('./QuizIO');
app.set('view engine', 'ejs');


var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.post('/admin' , urlencodedParser , function (req,res) {
    // console.log(req.body);
    io.addQuestions(req.body);
    res.redirect('/admin');
});

app.get('/admin' , function (req,res) {
   res.render('admin'); 
});

app.listen(3000);
console.log('on 3000');
