const express = require('express'),
    app = express(),
    session = require('express-session'),
    model = require('./model.js'),
    config = require('./config.json'),
    io = require('./QuizIO'),
    bodyParser = require('body-parser'),
    codeExec = require('./codeIO'),
    fse = require('fs-extra');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static('public'));
app.use(session({
    secret: (new Date().getTime() + config.sessionKeyValue).toString()
}));

var exec = require('child_process').exec,
    fs = require('fs');
var COUNT = config.questionCount;
var urlencodedParser = bodyParser.urlencoded({
    extended: false
});
var studentMap = new Map(),
    mappedQB = new Map(),
    questionBank = undefined,
    questionsExist = false;

app.post('/login', (req, res) => {
    // getting parameters from login page 
    console.log(req.body);
    if (req.body.username && req.body.password) {
        req.session.username = req.body.username;
        req.session.password = req.body.password;
    } else {
        res.redirect('/login');
    }
    res.statusCode = 200;
    res.redirect('/');
});
app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.get('/quiz', (req, res) => {
    if (questionsExist == false) {
        // No quiz since questions do not exist , admin fault
        res.render('error.ejs', {
            context: 'Error',
            msg: 'Please ask admin to make questions for the Quiz and restart server. :-)'
        });
    }
    console.log('Returning quiz page to : ', req.session.username);
    var questions = getQuestions(COUNT);
    console.log('Starting quiz with questions : ', questions.length);
    let current_student = studentMap.get(req.session.username);
    // If this happens, something might be wrong ( TEST )
    if (current_student == undefined)
        res.redirect('/login');
    // Adjust code for rendering if there are any problems with < and > 
    /*for ( var i=0 ; i<questions.length ; i++ )
        if ( questions[i].code.length > 0 ){
            questions[i].code = questions[i].code.replace("<","&lt;");
            questions[i].code = questions[i].code.replace(">","&gt;");
        }
    */
    // CHECK FOR RELOAD
    console.log('Checks for reload , happen here ');
    if (current_student.submitted == true) {
        res.render('error.ejs', {
            context: 'Test completed earlier',
            msg: 'Your score = ' + current_student.score
        });
    } else if (current_student.testStartTime == undefined && current_student.testEndTime == undefined) {
        console.log('Setting start and end times for fresh attempt ');
        current_student.testStartTime = new Date().getTime();
        // Since duration is in minutes , calculating the end time by adding the required amount 
        current_student.testEndTime = current_student.testStartTime + config.duration * 60 * 1000;
        res.render('quiz.ejs', {
            questions: questions,
            endTime: current_student.testEndTime
        });
    }
    // see if the current time is ok for the student to continue his test 
    else if (new Date().getTime() < current_student.testEndTime) {
        res.render('quiz.ejs', {
            questions: questions,
            endTime: current_student.testEndTime
        });
    } else {
        res.render('error.ejs', {
            context: 'Test completed earlier',
            msg: 'Your score = ' + current_student.score
        });
    }
});

app.post('/quiz', (req, res) => {
    console.log('Received answers');
    let current_student = studentMap.get(req.session.username);
    current_student.submitted = true;
    if (current_student.score != undefined) {
        res.render('error.ejs', {
            context: 'Error',
            msg: 'Test completed earlier , answers cannot be saved. Score : ' + current_student.score.toString()
        });
    } else {
        var answers = req.body,
            score = eval(answers, current_student);
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

function compareArray(a, b) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}

function write_to_file(code, extension, username, id) {
    var filePath = "code/" + username + " " + id + "." + extension;
    fse.ensureFileSync(filePath);
    fs.writeFileSync(filePath, code, (err) => {
        if (err) {
            return false;
        } else
            return filePath;
    });
}

async function execCode(code, lang, username, id, test_input) {
    if (lang == 'c++') {
        var result = await write_to_file(code, lang, username, id);
        if (result != false) {
            await exec("g++ " + result, (error, stdout, stderr) => {
                console.log('stdout: ' + stdout);
                console.log('stderr: ' + stderr);
                if (stdout.length > 0 || stderr.length > 0)
                    console.log("There was an error compiling the code");
                else
                    console.log("Compilation complete, proceeding to execution");
                if (error) {
                    console.log('exec error: ' + error);
                }
            });
            await exec("code/" + config.cppExecFile + "<< " + test_input, (error, stdout, stderr) => {
                console.log('stdout : ' + stdout);
                if (stderr.length > 0)
                    return false;
                else if (error) {
                    console.log('Error during execution');
                    return false;
                } else {
                    return stdout;
                }
            })
        }
    } else if (lang == 'python') {
        // execute python 
    } else if (lang == 'java') {
        // execute java
    }
    return false;
}

function eval(answers, student) {
    let score = 0;
    console.log('Answers received are : ');
    // console.log(answers);
    for (var i in answers) {
        console.log(mappedQB.get(i).type);
        console.log(answers[i]);
        if (mappedQB.get(i).type == 'match') {
            if (compareArray(mappedQB.get(i).answer, answers[i])) {
                score += config.pointsPerQuestion;
            }
        } else if (mappedQB.get(i).type == 'code') {
            // check for code validity 
            let question = mappedQB.get(i);
            if (question.lang == 'c++') {
                // handle c / c++ code 
                // send username and qid i 
                var output = execCode(answers[i], question.lang, student.username, i, question.test_input);
                if (output == false) {
                    console.log('Error while executing code');
                } else if (output == question.output)
                    score += config.pointsPerQuestion;
            } else if (question.lang == 'python') {
                // handle python code 
            } else if (question.lang == 'java') {
                // handle java code 
            }
        } else if (answers[i] === mappedQB.get(i).answer)
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
    questionsExist = true;
    for (var i = 0; i < questionBank.length; i++)
        mappedQB.set(questionBank[i].id.toString(), questionBank[i]);
}

function initServer() {
    console.log('Initializing server : --- ');
    console.log('Server at port : 3000');
    app.listen(3000);
    updateQuestions();
}

initServer();