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

var exec = util.promisify(require('child_process').exec),
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

app.post('/quiz', async (req, res) => {
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
            score = await eval(answers, current_student);
        console.log('\nEval complete , continuing post');
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

function write_to_file(code, extension, fileName) {
    var filePath = "code/" + fileName + "." + extension;
    fse.ensureFileSync(filePath);
    fs.writeFileSync(filePath, code, (err) => {
        if (err) {
            return false;
        }
    });
    return filePath;
}

async function execCode(code, lang, username, id, test_input) {
    var fileName = username + "_" + id;
    console.log("File Name : " + fileName);
    if (lang == 'cpp') {
        var result = write_to_file(code, lang, fileName);
        console.log("File written to disk : ", result);
        if (result) {
            await exec("g++ " + result + " -o code/" + fileName + config.cppExecFile, (error, stdout, stderr) => {
                if (stdout.length > 0 || stderr.length > 0) {
                    console.log("There was an error compiling the code");
                    return false;
                } else
                    console.log("Compilation complete, proceeding to execution");
                if (error) {
                    console.log("Error during handling of process");
                    return false;
                }
            });
            console.log("\nCompiled file created for " + username + " question:" + id);
            console.log("Starting exection of program : " + "code/" + fileName + config.cppExecFile);
            await exec("code/" + fileName + config.cppExecFile + "<< " + test_input, (error, stdout, stderr) => {
                console.log('Output after execution : ' + stdout);
                if (stderr.length > 0) {
                    console.log("Error during execution of the file");
                    return false;
                } else if (error) {
                    console.log('Error during process , failure of server');
                    return false;
                } else {
                    console.log("Returning output")
                    return stdout;
                }
            });
        }
    } else if (lang == 'python') {
        // execute python 
    } else if (lang == 'java') {
        // execute java
    }
    return false;
}

async function eval(answers, student) {
    let score = 0;
    console.log("Evaluating answers");
    for (var i in answers) {
        let question = mappedQB.get(i);
        if (question.type == 'match') {
            if (compareArray(question.answer, answers[i])) {
                score += config.pointsPerQuestion;
            }
        } else if (question.type == 'coding') {
            console.log("Coding question");
            if (question.lang == 'cpp') {
                // handle c / c++ code 
                // send username and qid i 
                var output = await execCode(answers[i], question.lang, student.username, i, question.input);
                console.log('OUTPUT : ', output);
                if (output == false) {
                    console.log('Error while executing code');
                } else if (output == question.answer)
                    score += config.pointsPerQuestion;
                console.log("Completed checking code for cpp file ");
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