const express = require('express'),
    app = express(),
    session = require('express-session'),
    model = require('./model.js'),
    config = require('./config.json'),
    io = require('./QuizIO'),
    bodyParser = require('body-parser'),
    codeExec = require('./codeIO');

var COUNT = config.questionCount ;
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var studentMap = new Map() , mappedQB = new Map() , questionBank = undefined , questionsExist = false  ;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded());
app.use(session({
    secret: (new Date().getTime() + config.sessionKeyValue).toString()
}));

app.post('/login', (req, res) => {
    // getting parameters from login page 
    console.log(req.body);
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    res.statusCode = 200;
    res.redirect('/');
});
app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.get ( '/quiz' , (req,res) => {
    if ( questionsExist == false ){
        // No quiz since questions do not exist , admin fault
        res.render ( 'error.ejs' , { context : 'Error' , msg : 'Please ask admin to make questions for the Quiz and restart server. :-)' } );
    }
    console.log ( 'Returning quiz page to : ' , req.session.username );
    var questions = getQuestions( COUNT ); 
    console.log ( 'Starting quiz with questions : ' , questions.length );
    let current_student = studentMap.get(req.session.username);
    // If this happens, something might be wrong ( TEST )
    if ( current_student == undefined ) 
        res.redirect ( '/login' );
    
    // TEST 
        questions[0].code = `#include <iostream> 
            int main(){
                cout << "Hello world" << endl;
                cout << "This is so exciting" << endl;
                return 0;
            }`;
    // TEST

    // Adjust code for rendering if there are any problems with < and > 
    /*for ( var i=0 ; i<questions.length ; i++ )
        if ( questions[i].code.length > 0 ){
            questions[i].code = questions[i].code.replace("<","&lt;");
            questions[i].code = questions[i].code.replace(">","&gt;");
        }
    */
    current_student.testStartTime = new Date().getTime();
    // Since duration is in minutes , calculating the end time by adding the required amount 
    current_student.testEndTime = current_student.testStartTime + config.duration * 60 * 1000;
    res.render('quiz.ejs', {
        questions: questions,
        endTime: current_student.testEndTime
    });
});

app.post('/quiz', (req, res) => {
    console.log('Received answers');
    let current_student = studentMap.get(req.session.username);
    if (current_student.score != undefined) {
        res.render('error.ejs', {
            context: 'Error',
            msg: 'Test completed earlier , answers cannot be saved. Score : ' + current_student.score.toString()
        });
    } else {
        var answers = req.body,
            score = eval(answers);
        console.log(answers);
        current_student.score = score;
        res.render('error.ejs', {
            context: 'Test complete',
            msg: 'Answers saved successfully , score = ' + score
        });
    }
});

app.post('/admin', urlencodedParser, function (req, res) {
    // console.log(req.body);
    io.addQuestions(req.body);
    res.redirect('/admin');
});

app.get('/admin', function (req, res) {
    res.render('admin');
});

app.post('/code', urlencodedParser, function (req, res) {
    var result = codeExec.exec(req.body);
    updateQuestions();
});

app.get('/', (req, res) => {
    if (req.session.username == undefined || req.session.password == undefined) {
        // if username does not exist in the cookies
        res.redirect('/login');
    } else if (studentMap.has(req.session.username)) {
        var current_student = studentMap.get(req.session.username);
        if (current_student.score == undefined) {
            console.log('Making score 0 since previous attempt unsuccessful');
            current_student.score = 0;
        }
        res.render('error.ejs', {
            context: 'Error',
            msg: 'Test completed earlier , answers cannot be saved. Score : ' + current_student.score
        });
    } else {
        // user authenticated 
        if (req.session.username == config.admin.username && req.session.password == config.admin.password) {
            // redirect to input page 
            res.redirect('/admin');
        } else {
            // registering student details 
            studentMap.set(req.session.username, new model.student(req.session.username));
            // req.session.destroy() after logout
            res.redirect('/quiz');
        }
    }
});

function eval(answers) {
    let score = 0;
    console.log('Answers received are : ');
    console.log(answers);
    for (var i in answers) {
        if (answers[i] == mappedQB.get(i).answer)
            score += config.pointsPerQuestion;
        else {
            if (config.negativeMarking)
                score -= config.pointsPerQuestion;
        }
    }
    return score;
}

function getQuestions(count) {
    var questions = [],
        dupQuestions = JSON.parse(JSON.stringify(questionBank));
    for (var i = 0; i < count; i++) {
        var randomIndex = Math.floor(Math.random() * dupQuestions.length);
        questions.push(dupQuestions[randomIndex]);
        dupQuestions.splice(randomIndex, 1);
    }
    return questions;
}

function updateQuestions() {
    questionBank = io.fetchQuestions().questions;
    if (COUNT > questionBank.length) {
        COUNT = questionBank.length;
    }

   

    questionsExist = true ;
    for ( var i =0 ; i < questionBank.length ; i++ )
        mappedQB.set ( questionBank[i].id.toString() , questionBank[i] );
}

function initServer() {
    console.log('Initializing server : --- ');
    console.log('Server at port : 3000');
    app.listen(3000);
    updateQuestions();
}

initServer();