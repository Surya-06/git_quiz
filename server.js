const express = require('express'),
    app = express(),
    session = require('express-session');

var config = require('./config.json');

const COUNT = config.questionCount ;

var students_attempted = [] ;
var students_completed = new Map();
var questionBank ;

app.set ( 'view engine' , 'ejs' );
app.use(express.json());
app.use(express.urlencoded());
app.use ( session({
    secret : "secret-key"
}));

app.post ( '/login' , ( req,res) => {
    // getting parameters from login page 
    console.log ( req.body );
    req.session.username = req.body.username ;
    req.session.password = req.body.password ;
    res.statusCode = 200 ;
    res.redirect ( '/' );
});
app.get ( '/login' , (req,res) => {
    res.render ( 'login.ejs' );
});

app.get ( '/quiz' , (req,res) => {
    console.log ( 'Returning quiz page to : ' , req.session.username );
    var questions = getQuestions( COUNT ); 
    console.log ( 'Starting quiz with questions : ' , questions.length );
    res.render('quiz.ejs' , {questions : questions} );
});

app.post ( '/quiz' , (req,res) => {
    if ( students_completed.has ( req.session.username ) ){
        res.render ( 'error.ejs' , { context : 'Error' , msg : 'Test completed earlier , answers cannot be saved. Score : 0' } );
    }
    else {
        var answers = req.body , username = req.session.username ,
         score = eval ( answers );
        students_completed.set ( username , score );
        res.render ( 'error.ejs' , { context : 'Test complete' , msg : 'Answers saved successfully , score = ' + score } );
    }
});

app.get ( '/input' , (req,res) => {
    // return input html file
    res.sendStatus(200);
});

app.get ( '/' , (req,res) => {    
    if ( req.session.username == undefined || req.session.password == undefined ){
        // if username does not exist in the cookies
        res.redirect ( '/login' );
    }
    else if ( students_attempted.indexOf ( req.session.username ) != -1 ){
        students_completed.set ( req.session.username , 0 );
        res.render ( 'error.ejs' , { context : 'Error' , msg : 'Test completed earlier , answers cannot be saved. Score : 0' } );
    }
    else {
        // user authenticated 
        if ( req.session.username == config.admin.username && req.session.password == config.admin.password ){
            // redirect to input page 
            res.redirect ( '/input' );
        }
        else {
            students_attempted.push ( req.session.username );
            // req.session.destroy() after logout
            res.redirect ( '/quiz' );
        }
    }
});

console.log ( 'Server at port : 3000' );
app.listen ( 3000 );

function eval ( answers ) {
    // TODO IMPLEMENT EVAL 
}

function getQuestions(count){
    var questions = [] , dupQuestions = JSON.parse ( JSON.stringify ( questionBank ) );
    console.log ( dupQuestions.length );
    for ( var i=0 ; i<count ; i++ ){
        var randomIndex = Math.floor(Math.random()*dupQuestions.length);
        console.log ( 'random index : ' , randomIndex );
        console.log ( 'question : ' , dupQuestions[randomIndex] );
        questions.push ( dupQuestions[randomIndex] );
        dupQuestions.splice ( randomIndex , 1 );
    }
    console.log ( 'No. of questions : ' , questions.length );
    return questions ;
}

function initServer(){
    console.log ( 'Initializing server : --- ' );
    // var questions = db.getQuestions();
    // Sample questions 
    questionBank = [
        {
            qid : 1 , 
            type : 'mcq' , 
            question_text : 'this is the question' , 
            options : [ 'a' , 'b' , 'c' , 'd' ],
            answer : 'a' 
        },
        {
            qid : 2 ,
            type : 'fill' ,
            question : 'this is another question' ,
            answer : 20  
        }
    ] ; // GET QUESTIONS FROM JSON FILE 

}

initServer();