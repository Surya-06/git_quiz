const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const io = require('./QuizIO');
const codeExec = require('./codeIO');
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

app.post('/code',urlencodedParser,function(req,res){
    var result = codeExec.exec(req.body);
});

app.listen(3000);
console.log('on 3000');
