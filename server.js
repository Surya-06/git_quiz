// START WITH  COMMAND : node server.js
// Type : studentMap : Map ( username , Model.student )

const express = require("express"),
  app = express(),
  session = require("express-session"),
  model = require("./libs/model.js"),
  config = require("./config.json"),
  io = require("./libs/QuizIO"),
  bodyParser = require("body-parser"),
  codeExec = require("./libs/codeIO"),
  console_functions = require('./libs/console_functions.js'),
  evaluate = require('./libs/evaluate.js'),
  questionHandler = require('./libs/question_handler.js'),
  authenticationHandler = require('./libs/authenticationHandler.js'),
  multer = require('multer'),
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, __dirname + '/public/images')
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)
    }
  });

const upload = multer({
  storage: storage
});

var LOG = config.debug ? console.log.bind(console) : function () {};

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"));
app.use(
  session({
    secret: (new Date().getTime() + config.sessionKeyValue).toString()
  })
);

var COUNT = config.questionCount;
var urlencodedParser = bodyParser.urlencoded({
  extended: false
});
var studentMap = new Map(),
  mappedQB = new Map(),
  questionBank = undefined,
  questionsExist = false,
  namesMap = new Map();

// MAIN PAGE ACCESS 
app.get("/", (req, res) => {
  if (req.session.username == undefined || req.session.password == undefined) {
    // if username does not exist in the cookies
    req.session.loginComplete = false;
    res.redirect("/login");
  } else if (studentMap.has(req.session.username)) {
    res.redirect('/quiz');
    return;
  } else {
    // user authenticated
    if (req.session.username == config.admin.username && req.session.password == config.admin.password) {
      // redirect to input page
      res.redirect("/admin_main");
    } else {
      // registering student details
      let name = namesMap.get(req.session.username) ? namesMap.get(req.session.username) : 'No name';
      studentMap.set(
        req.session.username,
        new model.student(req.session.username, name)
      );
      // req.session.destroy() after logout
      res.redirect("/quiz");
    }
  }
});

// POST FROM THE CODE PAGE 
app.post("/code", urlencodedParser, function (req, res) {
  var result = codeExec.exec(req.body);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
});

// GET FOR CONFIGURATION PAGE 
app.get("/cfg", authenticationHandler.checkAuthentication, function (req, res) {
  var cfg = io.fetchCFG();
  res.send(cfg);
});

// POST FOR CONFIGURATION PAGE 
app.post("/cfg", authenticationHandler.checkAuthentication, function (req, res) {
  var cfg = req.body.cfg;
  io.saveCFG(cfg);
  console.log(cfg);
  res.redirect("admin_question_input");
});

// HANDLE INVALID AUTHENTICATION 
app.use("/cfg", authenticationHandler.errorRedirect);

// GET FROM THE ADMIN QUESTION PAGE 
app.get("/admin_question_input", authenticationHandler.checkAuthentication, function (req, res) {
  var q = io.fetchQuestions();
  res.render("admin_question_input", {
    cfg: "",
    questions: q.questions
  });
});

// POST FROM THE ADMIN QUESTION PAGE 
app.post("/admin_question_input", upload.single('img'), authenticationHandler.checkAdminAuthentication, urlencodedParser, function (req, res) {
  // LOG(req.body);
  var questionJson = req.body;
  if (req.file) {
    questionJson.img = req.file.originalname;
  }
  io.addQuestions(questionJson);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
  res.redirect("/admin_question_input");

});

// HANDLE INVALID AUTHENTICATION
app.use("/admin_question_input", authenticationHandler.errorRedirect);

// GET FOR QUIZ DATA PAGE 
app.get("/quiz", authenticationHandler.checkAuthentication, (req, res) => {
  if (questionsExist == false) {
    // No quiz since questions do not exist , admin fault
    res.render("error.ejs", {
      context: "Error",
      msg: "Please ask admin to make questions for the Quiz and restart server. :-)"
    });
  }
  LOG("Returning quiz page to : ", req.session.username);
  var questions = questionHandler.getQuestions(COUNT, questionBank);
  LOG("Starting quiz with questions : ", questions.length);
  let current_student = studentMap.get(req.session.username);
  LOG("Checks for reload , happen here ");
  if (current_student.testAttempted == true) {
    if (current_student.score == undefined) {
      //TODO : SUBMIT SCORE BEFORE RELOAD HANDLING 
      current_student.score = 0;
      current_student.flag = current_student.flagValues['reload'];
    }
    if (current_student.testEndTime == undefined) {
      // RELOAD CASE
      current_student.flag = current_student.flagValues['reload'];
      current_student.testEndTime = new Date();
    }

    res.render("error.ejs", {
      context: "Test completed earlier",
      msg: "Your score = " + current_student.score
    });
  } else if (current_student.testAttempted == false) {
    LOG("Setting quiz up for new attempt");
    current_student.testDuration = config.duration;
    current_student.testAttempted = true;
    current_student.testStartTime = new Date();
    res.render("quiz.ejs", {
      questions: questions,
      endTime: config.duration,
      username: current_student.username,
      name: current_student.name
    });
  } else {
    res.render("error.ejs", {
      context: "Test completed earlier",
      msg: "Your score = " + current_student.score
    });
  }
});

// POST FROM THE QUIZ DATA PAGE 
app.post("/quiz", authenticationHandler.checkAuthentication, async (req, res) => {
  LOG("Received answers");
  let current_student = studentMap.get(req.session.username);
  current_student.testAttempted = true;
  current_student.testEndTime = new Date();
  LOG('Student : ', current_student.username);
  LOG('End Time : ', current_student.testEndTime);
  if (current_student.score != undefined) {
    res.render("error.ejs", {
      context: "Error",
      msg: "Test completed earlier , answers cannot be saved. Score : " +
        current_student.score.toString()
    });
  } else {
    var answers = req.body;
    evaluate.eval(answers, current_student, mappedQB);
    LOG("\nEval complete , continuing post");
    res.render("error.ejs", {
      context: "Test complete",
      msg: "Answers saved successfully"
    });
  }
});

// INVALID AUTHENTICATION
app.use("/quiz", authenticationHandler.errorRedirect);

// GET FOR LOGIN PAGE
app.get("/login", (req, res) => {
  if (req.session.loginComplete == false) {
    LOG('first time login');
    res.render("login.ejs");
  } else {
    LOG('PREV LOGIN COMPLETE');
    res.redirect('/');
  }
  return;
});

// POST AFTER LOGIN 
app.post("/login", (req, res) => {
  LOG(req.body);
  if (
    req.body.username && req.body.password && !isNaN(req.body.username) &&
    req.body.username >= config.username.lower && req.body.username <= config.username.upper &&
    req.body.password == config.password
  ) {
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    res.statusCode = 200;
    req.session.loginComplete = true;
    res.redirect("/");
  } else if (req.body.username == config.admin.username && req.body.password == config.admin.password) {
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    res.redirect("/admin_main");
    return;
  } else {
    res.render("login.ejs");
    return;
  }
});

// GET FOR ADMIN PAGE 
app.get('/admin_main', authenticationHandler.checkAdminAuthentication, (req, res) => {
  if (req.session.username == config.admin.username && req.session.password == config.admin.password) {
    res.render('admin_main.ejs', {
      studentDetails: studentMap
    });
    return;
  } else {
    res.render("error.ejs", {
      context: 'Invalid authentication',
      msg: "Please use valid authentication to access page"
    });
    return;
  }
});

// POST FOR ADMIN PAGE 
app.post('/admin_main', authenticationHandler.checkAdminAuthentication, (req, res) => {
  res.redirect('/login');
  return;
});

// POST FOR UPDATE QUESTIONS
app.post('/updateQuestions', authenticationHandler.checkAdminAuthentication, (req, res) => {

  io.saveQuestions(req.body);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
  res.redirect('/admin_question_input');
});

// HANDLE INVALID AUTHENTICATION
app.use("/admin_main", authenticationHandler.errorRedirect);
app.use('/updateQuestions', authenticationHandler.errorRedirect);

// GET FOR DOWNLOAD RESULTS PAGE 
app.get('/downloadResult', authenticationHandler.checkAdminAuthentication, (req, res) => {
  LOG('Request received');
  let filePath = console_functions.writeToExcel(studentMap, COUNT);
  res.download(__dirname + '\\' + filePath);
});

// HANDLE INVALID AUTHENTICATION
app.use('/downloadResult', authenticationHandler.errorRedirect);

// POST HANDLING FOR DELETE QUESTION PAGE 
app.post('/deleteQuestion', authenticationHandler.checkAdminAuthentication, (req, res) => {
  var id = req.body.id;
  var data = io.fetchQuestions();

  for (var i = 0; i < data.questions.length; i++) {
    if (id == data.questions[i].id) {
      data.questions.splice(i, 1);
      break;
    }
  }

  io.saveQuestions(data);
  res.redirect('/admin_question_input');
});

// HANDLE INVALID AUTHENTICATION
app.use('deleteQuestion', authenticationHandler.errorRedirect);

// Restart attempt handling 
app.get('/restartAttempt', authenticationHandler.checkAdminAuthentication, (req, res) => {
  let current_student = studentMap.get(req.query.id);
  current_student.resetStats();
  res.render('error.ejs', {
    context: 'Setting changed',
    msg: 'Re-attempt activated'
  });
  return;
});

app.get('/results', authenticationHandler.checkAdminAuthentication, (req, res) => {
  var id = req.query.id;
  var studentData = studentMap.get(id);
  console_functions.generatePDF(studentData);
  if (studentData != undefined) {
    res.render("results.ejs", {
      questions: studentData.answers,
      id: id
    });
  } else {
    res.render('admin_main.ejs', {
      studentDetails: studentMap
    });
  }

});

app.use('/restartAttempt', authenticationHandler.errorRedirect);

function initServer() {
  LOG("Initializing server : --- ");
  console.log("Server at port : 3000");
  app.listen(3000);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  namesMap = console_functions.getNamesFromExcel();
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
  console_functions.activateConsoleFunctions(studentMap);
  // Activate periodic save to excel file 
  setInterval(() => {
    console_functions.writeToExcel(studentMap, COUNT);
    for (let student of studentMap.getKeys())
      console_functions.generatePDF(studentMap.get(student));
  }, Number.parseInt(config.saveInterval) * 60000);
}

initServer();